import type { Store, StoredState } from "./store.ts";
import { EMPTY_STATE } from "./store.ts";
import type { CycleResult } from "../agents/cycle.ts";
import type { AuditEntry } from "../audit/chain.ts";
import type { Action } from "../intelligence/profitability.ts";

type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Array<Record<string, any>>>;

/** Armazenamento em Postgres (Neon). Requer a migração db/migrations/001_init.sql. */
export class NeonStore implements Store {
  readonly durable = true;
  private sqlPromise: Promise<Sql> | null = null;
  private readonly url: string;

  constructor(url: string) {
    this.url = url;
  }

  private sql(): Promise<Sql> {
    this.sqlPromise ??= import("@neondatabase/serverless").then((m) => m.neon(this.url) as unknown as Sql);
    return this.sqlPromise;
  }

  async load(now: Date): Promise<StoredState> {
    const sql = await this.sql();
    const day = now.toISOString().slice(0, 10);
    const [decisions, audits, today, total, pause] = await Promise.all([
      sql`SELECT action, margin FROM decisions ORDER BY at DESC LIMIT 20`,
      sql`SELECT seq, ts, payload, prev_hash, hash FROM audit_log ORDER BY seq DESC LIMIT 50`,
      sql`SELECT COALESCE(SUM(cost_brl_day), 0) AS v FROM orders WHERE at::date = ${day}::date`,
      sql`SELECT COALESCE(SUM(cost_brl_day), 0) AS v FROM orders`,
      sql`SELECT value FROM system_state WHERE key = 'manual_pause'`,
    ]);
    const tail: AuditEntry[] = audits
      .map((r) => ({ seq: Number(r.seq), ts: String(r.ts), payload: String(r.payload), prevHash: String(r.prev_hash), hash: String(r.hash) }))
      .reverse();
    const ordered = [...decisions].reverse();
    return {
      ...EMPTY_STATE,
      prevAction: ((decisions[0]?.action as Action | undefined) ?? "pausar"),
      margins: ordered.map((r) => (r.margin === null || r.margin === undefined ? null : Number(r.margin))),
      lastAudit: tail[tail.length - 1] ?? null,
      auditTail: tail,
      spentTodayBrl: Number(today[0]?.v ?? 0),
      spentTotalBrl: Number(total[0]?.v ?? 0),
      manualPause: pause[0]?.value === true,
    };
  }

  async save(result: CycleResult, audit: AuditEntry, _spentBrl: number): Promise<void> {
    const sql = await this.sql();
    const at = result.at;
    for (const p of result.prices) {
      if (p.ok) await sql`INSERT INTO market_snapshots (kind, source, value, collected_at, age_seconds, stale) VALUES ('price_btc_brl', ${p.source}, ${JSON.stringify(p.value)}::jsonb, ${p.collectedAt}, 0, false)`;
    }
    if (result.network.ok) {
      await sql`INSERT INTO market_snapshots (kind, source, value, collected_at, age_seconds, stale) VALUES ('network', ${result.network.source}, ${JSON.stringify(result.network.value)}::jsonb, ${result.network.collectedAt}, 0, false)`;
    }
    const margin = result.economics.rented?.margin ?? result.economics.asic?.margin ?? null;
    await sql`INSERT INTO decisions (at, action, margin, context, validation) VALUES (${at}, ${result.decision}, ${margin}, ${JSON.stringify({ economics: result.economics, priceBrl: result.verdict.priceBrl })}::jsonb, ${JSON.stringify({ state: result.verdict.state, reasons: result.verdict.reasons })}::jsonb)`;
    for (const o of result.orders) {
      await sql`INSERT INTO orders (at, simulated, ph, price_per_ph_day_brl, cost_brl_day) VALUES (${o.at}, true, ${o.ph}, ${o.pricePerPhDayBrl}, ${o.costBrlDay})`;
    }
    if (result.verdict.state !== "NORMAL") {
      await sql`INSERT INTO risk_events (at, state, reasons, actor) VALUES (${at}, ${result.verdict.state}, ${JSON.stringify(result.verdict.reasons)}::jsonb, 'guardiao')`;
    }
    for (const a of result.agents) {
      await sql`INSERT INTO agent_runs (at, agent_id, status, detail) VALUES (${at}, ${a.id}, ${a.status}, ${a.detail})`;
    }
    await sql`INSERT INTO audit_log (seq, ts, payload, prev_hash, hash) VALUES (${audit.seq}, ${audit.ts}, ${audit.payload}, ${audit.prevHash}, ${audit.hash})`;
  }

  async setManualPause(paused: boolean): Promise<void> {
    const sql = await this.sql();
    await sql`INSERT INTO system_state (key, value, updated_at) VALUES ('manual_pause', ${JSON.stringify(paused)}::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
}
