import type { GuardianConfig } from "./config.ts";

export function checkSpend(
  cfg: GuardianConfig,
  spentTodayBrl: number,
  spentTotalBrl: number,
  requestedBrl: number,
): { allowed: boolean; reason: string } {
  const { dailySpendBrl, totalSpendBrl } = cfg.limits;
  if (!Number.isFinite(requestedBrl) || requestedBrl <= 0) return { allowed: false, reason: "valor solicitado inválido" };
  if (dailySpendBrl === null || totalSpendBrl === null) return { allowed: false, reason: "sem orçamento definido" };
  if (spentTodayBrl + requestedBrl > dailySpendBrl) return { allowed: false, reason: "estouraria o gasto diário máximo" };
  if (spentTotalBrl + requestedBrl > totalSpendBrl) return { allowed: false, reason: "estouraria o gasto total máximo" };
  return { allowed: true, reason: "dentro dos limites" };
}

/** true = stop-loss diário atingido (resultado do dia ≤ −limite). */
export function stopLossHit(cfg: GuardianConfig, pnlTodayBrl: number): boolean {
  const sl = cfg.limits.dailyStopLossBrl;
  return sl !== null && pnlTodayBrl <= -sl;
}
