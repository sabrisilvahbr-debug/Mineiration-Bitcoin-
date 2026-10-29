import type { FetchLike } from "../sources/http.ts";
import type { Reading } from "../lib/types.ts";
import { fetchNetwork } from "../sources/mempool.ts";
import type { NetworkSnapshot } from "../sources/mempool.ts";
import { fetchPrices } from "../sources/price.ts";
import { fetchPriceHistory } from "../sources/history.ts";
import { evaluateGuardian } from "../guardian/freshness.ts";
import type { GuardianVerdict, MarketView } from "../guardian/freshness.ts";
import type { LoadedConfig, Mode } from "../guardian/config.ts";
import { checkSpend } from "../guardian/limits.ts";
import { computeAsicEconomics, computeRentedEconomics, decide } from "../intelligence/profitability.ts";
import type { Action, Economics } from "../intelligence/profitability.ts";
import { runScenarios } from "../intelligence/scenarios.ts";
import type { ScenarioResult } from "../intelligence/scenarios.ts";
import { appendAudit, verifyTail } from "../audit/chain.ts";
import type { Store } from "../store/store.ts";
import type { UserInputs } from "./inputs.ts";
import { AGENTS } from "./registry.ts";
import { buildReport } from "./report.ts";

export interface NetworkView {
  networkEhs: number;
  difficulty: number;
  hashpriceSatsPerPhDay: number;
  hashpriceBtcPerPhDay: number;
  feesIncluded: boolean;
  tipHeight: number | null;
  blocksToHalving: number | null;
  warnings: string[];
}
export interface SimOrder {
  at: string;
  ph: number;
  pricePerPhDayBrl: number;
  costBrlDay: number;
  note: string;
}
export type AgentStatus = "trabalhando" | "alerta" | "ocioso" | "pausado_risco" | "em_espera";
export interface AgentRuntime {
  id: number;
  name: string;
  status: AgentStatus;
  detail: string;
}
export interface Forecast {
  difficultyChangePercent: number;
  estimatedRetargetDate: string;
  remainingBlocks: number;
  blocksToHalving: number | null;
  halvingEstimate: string | null;
  note: string;
}
export interface CycleResult {
  at: string;
  refused: boolean;
  mode: Mode;
  config: { trusted: boolean; notice: string };
  network: Reading<NetworkView>;
  prices: Array<Reading<number>>;
  verdict: GuardianVerdict;
  economics: { rented: Economics | null; asic: Economics | null; message: string | null; hashpriceNote: string | null };
  decision: Action | null;
  decisionNote: string;
  scenarios: { d30: ScenarioResult | null; d90: ScenarioResult | null; note: string; premises: string };
  forecast: Forecast | null;
  orders: SimOrder[];
  agents: AgentRuntime[];
  report: string;
  notices: string[];
  chainOk: boolean;
}

export interface CycleDeps {
  fetch: FetchLike;
  now: Date;
  loaded: LoadedConfig;
  inputs: UserInputs;
  store: Store;
  env?: Record<string, string | undefined>;
  withScenarios?: boolean;
}

const PREMISES =
  "Preço do BTC sem tendência (média zero) e volatilidade do histórico real; hashrate da rede cresce como no histórico real; taxas de transação constantes; custo diário fixo. Não é previsão.";

export async function runCycle(d: CycleDeps): Promise<CycleResult> {
  const cfg = d.loaded.config;
  const at = d.now.toISOString();
  const notices: string[] = [d.loaded.notice];
  const env = d.env ?? {};

  const stored = await d.store.load(d.now);

  // Segurança (agente 15): chave com permissão de saque no ambiente bloqueia tudo.
  const withdrawKeys = Object.keys(env).filter((k) => /withdraw|saque/i.test(k) && (env[k] ?? "") !== "");
  const securityBlock = withdrawKeys.length > 0;
  if (securityBlock) notices.push(`CRÍTICO: variável com permissão de saque detectada (${withdrawKeys.join(", ")}). Tudo bloqueado.`);

  // Coleta (agentes 2, 3, 4). Ciclo recusado não consulta nada.
  const refused = d.loaded.refuse;
  const network: Reading<NetworkSnapshot> = refused
    ? { ok: false, source: "mempool.space", collectedAt: at, error: "ciclo recusado pelo Guardião" }
    : await fetchNetwork(d.fetch, d.now);
  const prices: Array<Reading<number>> = refused ? [] : await fetchPrices(d.fetch, d.now);

  const view: MarketView = {
    prices: prices.flatMap((p) => (p.ok ? [{ source: p.source, value: p.value, collectedAt: p.collectedAt }] : [])),
    hashpriceExternal: null,
    hashpriceOwn: network.ok ? { value: network.value.hashpriceBtcPerPhDay, collectedAt: network.collectedAt } : null,
    network: network.ok ? { collectedAt: network.collectedAt } : null,
    orderStatus: null,
  };
  let verdict = evaluateGuardian(view, cfg, d.now, stored.manualPause);
  if (refused || securityBlock) {
    verdict = {
      ...verdict,
      state: "PAUSADO_RISCO",
      purchasesAllowed: false,
      pauseExistingOrders: true,
      reasons: [refused ? `Ciclo recusado: ${d.loaded.notice}` : "Chave com permissão de saque detectada", ...verdict.reasons],
    };
  }

  const networkView: Reading<NetworkView> = network.ok
    ? {
        ok: true,
        source: network.source,
        collectedAt: network.collectedAt,
        value: {
          networkEhs: network.value.networkPh / 1000,
          difficulty: network.value.hashrate.currentDifficulty,
          hashpriceSatsPerPhDay: network.value.hashpriceSatsPerPhDay,
          hashpriceBtcPerPhDay: network.value.hashpriceBtcPerPhDay,
          feesIncluded: network.value.feesIncluded,
          tipHeight: network.value.tipHeight,
          blocksToHalving: network.value.blocksToHalving,
          warnings: network.value.warnings,
        },
      }
    : network;

  // Analista (agente 5)
  let rented: Economics | null = null;
  let asic: Economics | null = null;
  let message: string | null = null;
  let hashpriceNote: string | null = null;
  const hp = verdict.hashpriceUsed === "propria" && network.ok ? network.value.hashpriceBtcPerPhDay : null;
  if (network.ok && !network.value.feesIncluded) hashpriceNote = "Hashprice calculado só com o subsídio do bloco (sem taxas): valor-piso.";
  if (hp !== null && verdict.priceBrl !== null) {
    try {
      if (d.inputs.rented) rented = computeRentedEconomics({ ...d.inputs.rented, hashpriceBtcPerPhDay: hp, btcBrl: verdict.priceBrl });
      if (d.inputs.asic) asic = computeAsicEconomics({ ...d.inputs.asic, hashpriceBtcPerPhDay: hp, btcBrl: verdict.priceBrl });
    } catch (e) {
      message = `Entrada inválida: ${(e as Error).message}`;
    }
    if (!rented && !asic && !message) message = "Informe PH/s, preço por PH/dia e taxas (ou dados do ASIC) para calcular a margem.";
  } else {
    message = "Sem preço ou hashprice confiável neste ciclo: nenhuma conta é feita.";
  }

  // Decisão com histerese; o Guardião tem poder de veto.
  const current = rented ?? asic;
  let decision: Action | null = null;
  let decisionNote = message ?? "";
  if (current) {
    const margins = [...stored.margins, current.margin];
    decision = decide(margins, stored.prevAction, cfg.policy);
    decisionNote = current.margin === null ? "Margem indefinida (custo zero): pausar por segurança." : "";
    if (decision === "pausar" && current.margin !== null && current.margin > cfg.policy.pauseMargin) {
      let streak = 0;
      for (let i = margins.length - 1; i >= 0; i--) {
        const m = margins[i];
        if (m !== null && m !== undefined && m >= cfg.policy.resumeMargin) streak++;
        else break;
      }
      decisionNote = `Margem positiva, mas o sistema só retoma após ${cfg.policy.resumeConsecutive} coletas seguidas com margem ≥ ${cfg.policy.resumeMargin * 100}% (${Math.min(streak, cfg.policy.resumeConsecutive)}/${cfg.policy.resumeConsecutive}).`;
    }
  }
  if (verdict.state !== "NORMAL" && current) {
    if (verdict.pauseExistingOrders || decision === "aumentar") decision = "pausar";
    decisionNote = `Guardião (${verdict.state}): ${verdict.reasons[0] ?? "sem motivo registrado"}`;
  }

  // Ordens simuladas (agentes 6 e 7): só com orçamento, aprovação do Guardião e uma por dia.
  const orders: SimOrder[] = [];
  let spent = 0;
  if (decision === "aumentar" && verdict.purchasesAllowed && rented && stored.spentTodayBrl === 0) {
    const chk = checkSpend(cfg, stored.spentTodayBrl, stored.spentTotalBrl, rented.costBrlDay);
    if (chk.allowed) {
      orders.push({
        at,
        ph: d.inputs.rented?.ph ?? 0,
        pricePerPhDayBrl: d.inputs.rented?.pricePerPhDayBrl ?? 0,
        costBrlDay: rented.costBrlDay,
        note: "ORDEM SIMULADA (Fase 1, sem dinheiro real)",
      });
      spent = rented.costBrlDay;
    } else {
      notices.push(`Ordem simulada bloqueada pelo Guardião: ${chk.reason}`);
    }
  }

  // Simulador (agente 25)
  let d30: ScenarioResult | null = null;
  let d90: ScenarioResult | null = null;
  let scenarioNote = "informe os custos para simular.";
  if (current && d.withScenarios !== false && !refused && network.ok && verdict.priceBrl !== null && hp !== null) {
    const hist = await fetchPriceHistory(d.fetch, d.now);
    if (hist.ok) {
      const base = {
        paths: 2000,
        seed: Math.floor(d.now.getTime() / 86_400_000),
        ph: (d.inputs.rented ?? d.inputs.asic)?.ph ?? 0,
        hashpriceBtcPerPhDay: hp,
        btcBrl: verdict.priceBrl,
        poolFee: (d.inputs.rented ?? d.inputs.asic)?.poolFee ?? 0,
        costBrlDay: current.costBrlDay,
        priceHistory: hist.value,
        networkHashrateHistory: network.value.hashrate.historyHs,
        ...(cfg.limits.dailyStopLossBrl !== null ? { stopLossBrl: cfg.limits.dailyStopLossBrl } : {}),
      };
      d30 = runScenarios({ ...base, days: 30 });
      d90 = runScenarios({ ...base, days: 90 });
      scenarioNote = d30 ? `histórico: ${hist.source}.` : "histórico curto ou inválido (mínimo 31 pontos diários).";
    } else {
      scenarioNote = `sem histórico de preço (${hist.error}).`;
    }
  } else if (current) {
    scenarioNote = "sem preço/hashprice confiável neste ciclo.";
  }

  // Previsor (agente 18): números do próprio mempool.space, rotulados como estimativa.
  let forecast: Forecast | null = null;
  if (network.ok && network.value.difficultyAdjustment) {
    const da = network.value.difficultyAdjustment;
    const btH = network.value.blocksToHalving;
    forecast = {
      difficultyChangePercent: da.difficultyChangePercent,
      estimatedRetargetDate: new Date(da.estimatedRetargetDateMs).toISOString(),
      remainingBlocks: da.remainingBlocks,
      blocksToHalving: btH,
      halvingEstimate: btH !== null && btH > 0 ? new Date(d.now.getTime() + btH * 600_000).toISOString() : null,
      note: "Estimativa do mempool.space; muda até o fim do período. Data do halving assume 10 min por bloco.",
    };
  }

  // Auditor (agente 16) e trilha de auditoria
  const chainOk = verifyTail(stored.auditTail).ok;
  if (!chainOk) notices.push("CRÍTICO: cadeia de auditoria inconsistente.");
  const audit = appendAudit(stored.lastAudit, {
    at,
    state: verdict.state,
    decision,
    margin: current?.margin ?? null,
    priceBrl: verdict.priceBrl,
    hashpriceUsed: verdict.hashpriceUsed,
    reasons: verdict.reasons,
    orders: orders.length,
  }, at);

  const agents = buildAgents({ verdict, network, prices, rented, asic, decision, orders, d30, forecast, chainOk, loaded: d.loaded, env, inputs: d.inputs, notices });

  const result: CycleResult = {
    at,
    refused,
    mode: cfg.mode,
    config: { trusted: d.loaded.trusted, notice: d.loaded.notice },
    network: networkView,
    prices,
    verdict,
    economics: { rented, asic, message, hashpriceNote },
    decision,
    decisionNote,
    scenarios: { d30, d90, note: scenarioNote, premises: PREMISES },
    forecast,
    orders,
    agents,
    report: "",
    notices,
    chainOk,
  };
  result.report = buildReport(result);
  if (!refused) await d.store.save(result, audit, spent);
  return result;
}

interface Ctx {
  verdict: GuardianVerdict;
  network: Reading<NetworkSnapshot>;
  prices: Array<Reading<number>>;
  rented: Economics | null;
  asic: Economics | null;
  decision: Action | null;
  orders: SimOrder[];
  d30: ScenarioResult | null;
  forecast: Forecast | null;
  chainOk: boolean;
  loaded: LoadedConfig;
  env: Record<string, string | undefined>;
  inputs: UserInputs;
  notices: string[];
}

function buildAgents(c: Ctx): AgentRuntime[] {
  const paused = c.verdict.pauseExistingOrders;
  const okPrices = c.prices.filter((p) => p.ok).length;
  const st = (id: number): [AgentStatus, string] => {
    switch (id) {
      case 1:
        return c.verdict.reasons.length ? ["alerta", `Escalando: ${c.verdict.reasons[0]}`] : ["trabalhando", "Ciclo normal; em dúvida, a ação padrão é pausar"];
      case 2:
        return c.network.ok ? ["trabalhando", `Dados da rede de ${c.network.source}`] : ["alerta", `Sem dado: ${c.network.error}`];
      case 3:
        return c.network.ok ? ["trabalhando", "Hashprice próprio calculado (fonte externa não configurada)"] : ["alerta", "Sem hashprice: rede indisponível"];
      case 4:
        return okPrices === 2 ? ["trabalhando", "Duas fontes de preço frescas"] : okPrices === 1 ? ["alerta", "Só uma fonte respondeu: sem conferência"] : ["alerta", "Nenhuma fonte de preço respondeu"];
      case 5:
        return c.rented || c.asic ? ["trabalhando", `Margem calculada${c.decision ? `; recomendação: ${c.decision}` : ""}`] : ["ocioso", "Aguardando custos informados pelo CEO"];
      case 6:
        return paused ? ["pausado_risco", "Compras suspensas pelo Guardião"] : c.orders.length ? ["trabalhando", "Ordem simulada registrada"] : ["ocioso", c.verdict.purchasesAllowed ? `Sem ordem: decisão = ${c.decision ?? "sem decisão"}` : "Sem orçamento aprovado ou compras bloqueadas"];
      case 7:
        return paused ? ["pausado_risco", "Ordens simuladas pausadas"] : ["ocioso", "Sem ordens simuladas ativas"];
      case 12:
        return c.inputs.asic ? ["trabalhando", "Custo de energia calculado com a tarifa informada"] : ["em_espera", "Aguardando tarifa e consumo informados pelo CEO"];
      case 14:
        return c.verdict.state === "NORMAL" ? ["trabalhando", "Limites e frescor conferidos"] : c.verdict.state === "CAUTELA" ? ["alerta", c.verdict.reasons[0] ?? "Cautela"] : ["pausado_risco", c.verdict.reasons[0] ?? "Pausa"];
      case 15:
        return c.loaded.trusted ? ["trabalhando", "Config assinada e válida"] : ["alerta", c.loaded.notice];
      case 16:
        return c.chainOk ? ["trabalhando", "Cadeia de hashes íntegra"] : ["alerta", "Cadeia de hashes inconsistente"];
      case 18:
        return c.forecast ? ["trabalhando", "Ajuste de dificuldade e halving estimados"] : ["ocioso", "Sem dados de ajuste de dificuldade"];
      case 21:
        return ["ocioso", "Roda no CI do GitHub a cada mudança"];
      case 22:
        return ["trabalhando", c.env["TELEGRAM_BOT_TOKEN"] ? "Alertas por Telegram ativos" : "Alertas só no painel (Telegram não configurado)"];
      case 23:
        return ["trabalhando", "Resumo escrito com os números do ciclo"];
      case 24:
        return ["ocioso", "Aguardando rubrica de uma plataforma para avaliar"];
      case 25:
        return c.d30 ? ["trabalhando", "Cenários de 30 e 90 dias calculados"] : ["ocioso", "Sem custos ou histórico para simular"];
      default:
        return ["em_espera", ""];
    }
  };
  return AGENTS.map((a) => {
    const [status, detail] = st(a.id);
    if (status === "em_espera" && a.id !== 12) return { id: a.id, name: a.name, status, detail: a.waitingReason ?? detail };
    return { id: a.id, name: a.name, status, detail };
  });
}
