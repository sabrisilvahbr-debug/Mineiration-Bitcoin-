import { getJson, getText, num, obj, arr, errMsg } from "./http.ts";
import type { FetchLike } from "./http.ts";
import type { Reading } from "../lib/types.ts";
import { hashpriceSatsPerPhDay, hsToPh, satsToBtc } from "../intelligence/hashprice.ts";

export const MEMPOOL = "https://mempool.space";
export const SOURCE = "mempool.space";

/** Subsídio vigente por bloco (protocolo): 3,125 BTC de 840.000 a 1.049.999; próximo halving no bloco 1.050.000. */
export const SUBSIDY_SATS = 312_500_000;
export const NEXT_HALVING_HEIGHT = 1_050_000;

export interface HashrateData {
  currentHashrateHs: number;
  currentDifficulty: number;
  /** Série (mais antigo primeiro), em H/s. */
  historyHs: number[];
}
export interface DifficultyAdjustment {
  progressPercent: number;
  difficultyChangePercent: number;
  estimatedRetargetDateMs: number;
  remainingBlocks: number;
}
export interface RewardStats {
  blocks: number;
  avgRewardSatsPerBlock: number;
  avgFeeSatsPerBlock: number;
}

export function parseHashrate(j: unknown): HashrateData {
  const o = obj(j, "hashrate");
  const list = arr(o.hashrates, "hashrates").map((e, i) => num(obj(e, `hashrates[${i}]`).avgHashrate, "avgHashrate"));
  if (list.some((x) => x <= 0)) throw new TypeError("avgHashrate ≤ 0");
  const currentHashrateHs = num(o.currentHashrate, "currentHashrate");
  if (currentHashrateHs <= 0) throw new TypeError("currentHashrate ≤ 0");
  return { currentHashrateHs, currentDifficulty: num(o.currentDifficulty, "currentDifficulty"), historyHs: list };
}

export function parseDifficultyAdjustment(j: unknown): DifficultyAdjustment {
  const o = obj(j, "difficulty-adjustment");
  return {
    progressPercent: num(o.progressPercent, "progressPercent"),
    difficultyChangePercent: num(o.difficultyChange, "difficultyChange"),
    estimatedRetargetDateMs: num(o.estimatedRetargetDate, "estimatedRetargetDate"),
    remainingBlocks: num(o.remainingBlocks, "remainingBlocks"),
  };
}

export function parseRewardStats(j: unknown, blockCount: number): RewardStats {
  const o = obj(j, "reward-stats");
  const totalReward = num(o.totalReward, "totalReward");
  const totalFee = num(o.totalFee, "totalFee");
  if (totalReward <= 0 || totalFee < 0 || blockCount <= 0) throw new TypeError("reward-stats fora do esperado");
  return { blocks: blockCount, avgRewardSatsPerBlock: totalReward / blockCount, avgFeeSatsPerBlock: totalFee / blockCount };
}

export function parseTipHeight(t: string): number {
  const n = Number(t.trim());
  if (!Number.isInteger(n) || n <= 0) throw new TypeError("altura do bloco inválida");
  return n;
}

export interface NetworkSnapshot {
  hashrate: HashrateData;
  networkPh: number;
  difficultyAdjustment: DifficultyAdjustment | null;
  rewardStats: RewardStats | null;
  /** true se as taxas de transação entraram no cálculo (reward-stats); false = só subsídio (piso). */
  feesIncluded: boolean;
  tipHeight: number | null;
  blocksToHalving: number | null;
  hashpriceSatsPerPhDay: number;
  hashpriceBtcPerPhDay: number;
  warnings: string[];
}

export async function fetchNetwork(fetchImpl: FetchLike, now: Date = new Date()): Promise<Reading<NetworkSnapshot>> {
  const collectedAt = now.toISOString();
  try {
    const hashrate = parseHashrate(await getJson(fetchImpl, `${MEMPOOL}/api/v1/mining/hashrate/3m`));
    const warnings: string[] = [];
    const [da, rs, tip] = await Promise.allSettled([
      getJson(fetchImpl, `${MEMPOOL}/api/v1/difficulty-adjustment`).then(parseDifficultyAdjustment),
      getJson(fetchImpl, `${MEMPOOL}/api/v1/mining/reward-stats/144`).then((j) => parseRewardStats(j, 144)),
      getText(fetchImpl, `${MEMPOOL}/api/blocks/tip/height`).then(parseTipHeight),
    ]);
    const difficultyAdjustment = da.status === "fulfilled" ? da.value : null;
    if (da.status === "rejected") warnings.push(`ajuste de dificuldade indisponível: ${errMsg(da.reason)}`);
    const rewardStats = rs.status === "fulfilled" ? rs.value : null;
    if (rs.status === "rejected") warnings.push(`taxas dos últimos 144 blocos indisponíveis (usando só o subsídio, valor-piso): ${errMsg(rs.reason)}`);
    const tipHeight = tip.status === "fulfilled" ? tip.value : null;
    if (tip.status === "rejected") warnings.push(`altura do bloco indisponível: ${errMsg(tip.reason)}`);

    const networkPh = hsToPh(hashrate.currentHashrateHs);
    const avgReward = rewardStats ? rewardStats.avgRewardSatsPerBlock : SUBSIDY_SATS;
    const sats = hashpriceSatsPerPhDay(avgReward, networkPh);
    return {
      ok: true,
      source: SOURCE,
      collectedAt,
      value: {
        hashrate,
        networkPh,
        difficultyAdjustment,
        rewardStats,
        feesIncluded: rewardStats !== null,
        tipHeight,
        blocksToHalving: tipHeight !== null ? NEXT_HALVING_HEIGHT - tipHeight : null,
        hashpriceSatsPerPhDay: sats,
        hashpriceBtcPerPhDay: satsToBtc(sats),
        warnings,
      },
    };
  } catch (e) {
    return { ok: false, source: SOURCE, collectedAt, error: errMsg(e) };
  }
}
