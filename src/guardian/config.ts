import { createHmac, timingSafeEqual } from "node:crypto";
import { DEFAULT_POLICY } from "../intelligence/profitability.ts";
import type { Policy } from "../intelligence/profitability.ts";

export type Mode = "SIMULACAO" | "PILOTO" | "ESCALA";

export interface GuardianConfig {
  mode: Mode;
  freshness: {
    priceMaxAgeSec: number;
    hashpriceMaxAgeSec: number;
    networkMaxAgeSec: number;
    orderStatusMaxAgeSec: number;
    orderFailuresToPause: number;
    maxPriceDivergence: number;
  };
  limits: {
    /** null = não definido = nenhuma compra permitida. */
    dailySpendBrl: number | null;
    totalSpendBrl: number | null;
    dailyStopLossBrl: number | null;
  };
  policy: Policy;
}

/** Padrão restritivo: valores de frescor da ideia (seção 5), política inicial, sem orçamento. */
export const RESTRICTED_CONFIG: GuardianConfig = {
  mode: "SIMULACAO",
  freshness: {
    priceMaxAgeSec: 60,
    hashpriceMaxAgeSec: 900,
    networkMaxAgeSec: 900,
    orderStatusMaxAgeSec: 120,
    orderFailuresToPause: 3,
    maxPriceDivergence: 0.015,
  },
  limits: { dailySpendBrl: null, totalSpendBrl: null, dailyStopLossBrl: null },
  policy: DEFAULT_POLICY,
};

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x) && x >= 0;
}
function isNumOrNull(x: unknown): x is number | null {
  return x === null || isNum(x);
}

export function parseGuardianConfig(raw: unknown): GuardianConfig {
  const bad = (m: string): never => {
    throw new TypeError(`guardian.config inválido: ${m}`);
  };
  if (typeof raw !== "object" || raw === null) return bad("não é objeto");
  const r = raw as Record<string, any>;
  if (!["SIMULACAO", "PILOTO", "ESCALA"].includes(r.mode)) bad("mode");
  const f = r.freshness ?? bad("freshness");
  for (const k of ["priceMaxAgeSec", "hashpriceMaxAgeSec", "networkMaxAgeSec", "orderStatusMaxAgeSec", "orderFailuresToPause", "maxPriceDivergence"]) {
    if (!isNum(f[k])) bad(`freshness.${k}`);
  }
  const l = r.limits ?? bad("limits");
  for (const k of ["dailySpendBrl", "totalSpendBrl", "dailyStopLossBrl"]) {
    if (!isNumOrNull(l[k])) bad(`limits.${k}`);
  }
  const p = r.policy ?? bad("policy");
  if (typeof p.pauseMargin !== "number" || !Number.isFinite(p.pauseMargin)) bad("policy.pauseMargin");
  if (typeof p.resumeMargin !== "number" || !Number.isFinite(p.resumeMargin)) bad("policy.resumeMargin");
  if (!Number.isInteger(p.resumeConsecutive) || p.resumeConsecutive < 1) bad("policy.resumeConsecutive");
  return r as GuardianConfig;
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v !== null && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
}

export function signConfig(cfg: GuardianConfig, secret: string): string {
  if (!secret) throw new Error("segredo vazio");
  return createHmac("sha256", secret).update(canonical(cfg)).digest("hex");
}

export function verifyConfig(cfg: GuardianConfig, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = Buffer.from(signConfig(cfg, secret), "hex");
  let given: Buffer;
  try {
    given = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export interface LoadedConfig {
  config: GuardianConfig;
  trusted: boolean;
  /** true = o ciclo NÃO deve rodar. */
  refuse: boolean;
  notice: string;
}

/**
 * Regras: assinatura presente e válida → confiável. Assinatura presente e inválida → recusa.
 * Sem assinatura/segredo: em SIMULACAO roda no modo restrito (sem compras); em PILOTO/ESCALA recusa.
 */
export function loadGuardianConfig(raw: unknown, signature: string | undefined, secret: string | undefined): LoadedConfig {
  let cfg: GuardianConfig;
  try {
    cfg = parseGuardianConfig(raw);
  } catch (e) {
    return { config: RESTRICTED_CONFIG, trusted: false, refuse: true, notice: (e as Error).message };
  }
  if (signature) {
    if (secret && verifyConfig(cfg, signature, secret)) {
      return { config: cfg, trusted: true, refuse: false, notice: "config assinada e válida" };
    }
    return { config: RESTRICTED_CONFIG, trusted: false, refuse: true, notice: "assinatura da config não confere" };
  }
  if (cfg.mode === "SIMULACAO") {
    return {
      config: { ...cfg, limits: RESTRICTED_CONFIG.limits },
      trusted: false,
      refuse: false,
      notice: "config sem assinatura: modo restrito (nenhuma compra permitida)",
    };
  }
  return { config: RESTRICTED_CONFIG, trusted: false, refuse: true, notice: "PILOTO/ESCALA exigem config assinada" };
}
