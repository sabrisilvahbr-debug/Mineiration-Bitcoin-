import { createHash } from "node:crypto";

export const GENESIS = "0".repeat(64);

export interface AuditEntry {
  seq: number;
  ts: string;
  payload: string;
  prevHash: string;
  hash: string;
}

function hashOf(prevHash: string, seq: number, ts: string, payload: string): string {
  return createHash("sha256").update(`${prevHash}|${seq}|${ts}|${payload}`).digest("hex");
}

export function appendAudit(prev: AuditEntry | null, payload: unknown, ts: string): AuditEntry {
  const seq = prev ? prev.seq + 1 : 1;
  const prevHash = prev ? prev.hash : GENESIS;
  const body = JSON.stringify(payload);
  return { seq, ts, payload: body, prevHash, hash: hashOf(prevHash, seq, ts, body) };
}

export function verifyChain(entries: AuditEntry[]): { ok: boolean; brokenAt?: number } {
  let prevHash = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i] as AuditEntry;
    if (e.seq !== i + 1 || e.prevHash !== prevHash || e.hash !== hashOf(prevHash, e.seq, e.ts, e.payload)) {
      return { ok: false, brokenAt: e.seq };
    }
    prevHash = e.hash;
  }
  return { ok: true };
}

/** Verifica um trecho final da cadeia: o primeiro item é a âncora (seq e prevHash vêm dele). */
export function verifyTail(entries: AuditEntry[]): { ok: boolean; brokenAt?: number } {
  const first = entries[0];
  if (!first) return { ok: true };
  let prevHash = first.prevHash;
  let seq = first.seq;
  for (const e of entries) {
    if (e.seq !== seq || e.prevHash !== prevHash || e.hash !== hashOf(prevHash, e.seq, e.ts, e.payload)) {
      return { ok: false, brokenAt: e.seq };
    }
    prevHash = e.hash;
    seq++;
  }
  return { ok: true };
}
