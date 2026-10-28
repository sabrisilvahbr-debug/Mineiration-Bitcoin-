/** Blocos esperados por dia (86400 s / 600 s). */
export const BLOCKS_PER_DAY = 144;

export function hsToPh(hashrateHs: number): number {
  if (!Number.isFinite(hashrateHs) || hashrateHs < 0) throw new RangeError("hashrate inválido");
  return hashrateHs / 1e15;
}

/**
 * Hashprice próprio: sats ganhos por PH/s por dia.
 * = (recompensa média por bloco em sats × 144) / hashrate da rede em PH/s.
 */
export function hashpriceSatsPerPhDay(avgRewardSatsPerBlock: number, networkPh: number): number {
  if (!Number.isFinite(avgRewardSatsPerBlock) || avgRewardSatsPerBlock < 0) {
    throw new RangeError("recompensa média inválida");
  }
  if (!Number.isFinite(networkPh) || networkPh <= 0) throw new RangeError("hashrate da rede inválido");
  return (avgRewardSatsPerBlock * BLOCKS_PER_DAY) / networkPh;
}

export function satsToBtc(sats: number): number {
  return sats / 1e8;
}
