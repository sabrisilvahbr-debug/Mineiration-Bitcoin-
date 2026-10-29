import type { Action } from "../intelligence/profitability.ts";
import type { AuditEntry } from "../audit/chain.ts";
import type { CycleResult } from "../agents/cycle.ts";

export interface StoredState {
  prevAction: Action;
  /** Margens das últimas coletas (mais antiga primeiro). */
  margins: Array<number | null>;
  lastAudit: AuditEntry | null;
  auditTail: AuditEntry[];
  spentTodayBrl: number;
  spentTotalBrl: number;
  manualPause: boolean;
}

export interface Store {
  load(now: Date): Promise<StoredState>;
  save(result: CycleResult, audit: AuditEntry, spentBrl: number): Promise<void>;
}

export const EMPTY_STATE: StoredState = {
  prevAction: "pausar",
  margins: [],
  lastAudit: null,
  auditTail: [],
  spentTodayBrl: 0,
  spentTotalBrl: 0,
  manualPause: false,
};
