import type { CycleResult } from "./cycle.ts";

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const num = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
const when = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso)) + " (Brasília)";

/** Relator: só narra números que já existem no resultado do ciclo, sempre com fonte e horário. Não calcula. */
export function buildReport(r: CycleResult): string {
  const lines: string[] = [];
  lines.push(`Resumo do ciclo de ${when(r.at)}. Modo: ${r.mode}. Estado do Guardião: ${r.verdict.state}.`);

  if (r.verdict.priceBrl !== null) {
    const srcs = r.prices.filter((p) => p.ok).map((p) => `${p.source} às ${when(p.collectedAt)}`).join("; ");
    lines.push(`Preço do BTC: ${brl(r.verdict.priceBrl)} (${srcs}).`);
  } else {
    lines.push("Preço do BTC: sem dado confiável neste ciclo.");
  }
  if (r.network.ok) {
    const n = r.network.value;
    lines.push(
      `Rede: ${num(n.networkEhs)} EH/s e hashprice próprio de ${num(n.hashpriceSatsPerPhDay, 0)} sats por PH/s por dia (${r.network.source}, ${when(r.network.collectedAt)})${n.feesIncluded ? "" : "; só subsídio, sem taxas (valor-piso)"}.`,
    );
  } else {
    lines.push(`Rede: sem dado (${r.network.error}).`);
  }

  const e = r.economics.rented ?? r.economics.asic;
  if (e) {
    const m = e.margin === null ? "indefinida" : `${num(e.margin * 100, 1)}%`;
    lines.push(`Conta do dia com os dados informados: receita ${brl(e.revenueBrlDay)}, custo ${brl(e.costBrlDay)}, resultado ${brl(e.profitBrlDay)} (margem ${m}).`);
    if (e.profitBrlDay < 0) lines.push("A conta está no prejuízo com estes dados: a recomendação é pausar.");
  } else {
    lines.push(r.economics.message ?? "Sem custo informado: não há conta de lucratividade.");
  }
  lines.push(r.decision ? `Decisão: ${r.decision}. ${r.decisionNote}` : r.decisionNote);

  if (r.scenarios.d30) {
    const s = r.scenarios.d30;
    lines.push(`Cenários de 30 dias (lucro acumulado): pessimista ${brl(s.p5)}, base ${brl(s.median)}, otimista ${brl(s.p95)}; probabilidade de prejuízo ${num(s.probLoss * 100, 0)}%.`);
  } else {
    lines.push(`Cenários: ${r.scenarios.note}`);
  }
  if (r.verdict.reasons.length) lines.push(`Alertas: ${r.verdict.reasons.join("; ")}.`);
  lines.push("Aviso: isto não é aconselhamento financeiro, jurídico ou tributário. Mineração pode dar prejuízo.");
  return lines.join("\n");
}
