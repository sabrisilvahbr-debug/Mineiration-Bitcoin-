import type { Store, StoredState } from "./store.ts";
import { EMPTY_STATE } from "./store.ts";
import type { CycleResult } from "../agents/cycle.ts";
import type { AuditEntry } from "../audit/chain.ts";

/** Armazenamento em memória: testes e uso sem banco (o histórico se perde ao reiniciar). */
export class MemoryStore implements Store {
  readonly durable = false;
  state: StoredState = { ...EMPTY_STATE };
  private spendByDay = new Map<string, number>();
  private audit: AuditEntry[] = [];

  async load(now: Date): Promise<StoredState> {
    return {
      ...this.state,
      auditTail: this.audit.slice(-50),
      lastAudit: this.audit[this.audit.length - 1] ?? null,
      spentTodayBrl: this.spendByDay.get(now.toISOString().slice(0, 10)) ?? 0,
    };
  }

  async save(result: CycleResult, audit: AuditEntry, spentBrl: number): Promise<void> {
    this.audit.push(audit);
    const day = result.at.slice(0, 10);
    this.spendByDay.set(day, (this.spendByDay.get(day) ?? 0) + spentBrl);
    this.state = {
      ...this.state,
      prevAction: result.decision ?? this.state.prevAction,
      margins: [...this.state.margins, result.economics.rented?.margin ?? null].slice(-20),
      spentTotalBrl: this.state.spentTotalBrl + spentBrl,
    };
  }

  async setManualPause(paused: boolean): Promise<void> {
    this.state = { ...this.state, manualPause: paused };
  }
}
