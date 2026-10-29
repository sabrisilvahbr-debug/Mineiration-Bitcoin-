import type { ReactNode } from "react";
import type { CycleResult } from "../src/agents/cycle.ts";
import { age, brl, clock, num, pct } from "./format.ts";

const Stat = ({ label, children, src }: { label: string; children: ReactNode; src?: string }) => (
  <div className="stat">
    <span>{label}</span>
    <b>{children}{src ? <span className="src">{src}</span> : null}</b>
  </div>
);

export default function Panel({ r }: { r: CycleResult }) {
  const e = r.economics.rented ?? r.economics.asic;
  const priceSrc = r.prices.filter((p) => p.ok).map((p) => `${p.source}: ${age(p.collectedAt, r.at)} atrás`).join(" · ");
  const hp = r.network.ok ? r.network.value : null;
  const btcPerPh = hp ? hp.hashpriceBtcPerPhDay : null;
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="card">
        <h2>Estado <span className={`badge ${r.verdict.state}`}>{r.verdict.state.replace("_", " ")}</span> <span className="muted">· modo {r.mode}</span></h2>
        <p className="muted" style={{ margin: 0 }}>Atualizado em {clock(r.at)} (Brasília)</p>
        {r.verdict.reasons.map((x) => <p key={x} className="notice" style={{ margin: "8px 0 0" }}>{x}</p>)}
        {r.notices.filter((n) => /CRÍTICO|recusa|assinatura|restrito/i.test(n)).map((n) => <p key={n} className="notice" style={{ margin: "8px 0 0" }}>{n}</p>)}
      </section>

      <section className="card">
        <h2>Mercado (dados reais)</h2>
        <Stat label="Preço BTC/BRL" src={priceSrc || "sem dado"}>{r.verdict.priceBrl !== null ? brl(r.verdict.priceBrl) : "sem dado"}</Stat>
        <Stat label="Divergência entre fontes">{r.verdict.priceDivergence !== null ? pct(r.verdict.priceDivergence, 2) : "—"}</Stat>
        <Stat label="Hashrate da rede" src={r.network.ok ? `${r.network.source} · ${age(r.network.collectedAt, r.at)} atrás` : r.network.error}>
          {hp ? `${num(hp.networkEhs, 1)} EH/s` : "sem dado"}
        </Stat>
        <Stat label="Hashprice (próprio)" src={hp ? (hp.feesIncluded ? "subsídio + taxas dos últimos 144 blocos" : "só subsídio (valor-piso)") : undefined}>
          {hp ? `${num(hp.hashpriceSatsPerPhDay, 0)} sats/PH/dia${btcPerPh !== null && r.verdict.priceBrl !== null ? ` ≈ ${brl(btcPerPh * r.verdict.priceBrl)}` : ""}` : "sem dado"}
        </Stat>
        {r.forecast && (
          <>
            <Stat label="Próximo ajuste de dificuldade" src={`${r.forecast.note}`}>
              {r.forecast.difficultyChangePercent >= 0 ? "+" : ""}{num(r.forecast.difficultyChangePercent, 2)}% em {clock(r.forecast.estimatedRetargetDate)}
            </Stat>
            {r.forecast.blocksToHalving !== null && <Stat label="Blocos até o halving">{num(r.forecast.blocksToHalving, 0)}</Stat>}
          </>
        )}
        {hp?.warnings.map((w) => <p key={w} className="muted" style={{ margin: "6px 0 0" }}>⚠ {w}</p>)}
      </section>

      <section className="card">
        <h2>Conta do dia (com os custos que você informou)</h2>
        {e ? (
          <>
            <Stat label="Receita/dia">{brl(e.revenueBrlDay)}</Stat>
            <Stat label="Custo/dia">{brl(e.costBrlDay)}</Stat>
            <Stat label="Resultado/dia"><span className={e.profitBrlDay < 0 ? "loss" : "gain"}>{brl(e.profitBrlDay)}</span></Stat>
            <Stat label="Margem">{e.margin === null ? "indefinida" : pct(e.margin)}</Stat>
            <Stat label="Hashprice de equilíbrio">{e.breakEvenHashpriceBtcPerPhDay !== null ? `${num(e.breakEvenHashpriceBtcPerPhDay * 1e8, 0)} sats/PH/dia` : "—"}</Stat>
            {e.breakEvenTariffBrlKwh !== null && <Stat label="Tarifa máxima de equilíbrio">{brl(e.breakEvenTariffBrlKwh)}/kWh</Stat>}
            <Stat label="Decisão">{r.decision ?? "—"}</Stat>
            {r.decisionNote && <p className="muted" style={{ margin: "6px 0 0" }}>{r.decisionNote}</p>}
            {e.profitBrlDay < 0 && <p className="notice" style={{ margin: "8px 0 0" }}>Com estes dados a conta dá <b>prejuízo</b>: a recomendação é pausar.</p>}
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>{r.economics.message ?? "Informe PH/s, preço por PH/dia e taxas abaixo."}</p>
        )}
        {r.orders.map((o) => <p key={o.at} className="muted" style={{ margin: "6px 0 0" }}>{o.note}: {num(o.ph)} PH/s, custo {brl(o.costBrlDay)}/dia</p>)}
      </section>

      <section className="card">
        <h2>Cenários (lucro acumulado)</h2>
        {r.scenarios.d30 && r.scenarios.d90 ? (
          <table>
            <thead><tr><th>Horizonte</th><th>Pessimista (P5)</th><th>Base</th><th>Otimista (P95)</th><th>Prob. prejuízo</th></tr></thead>
            <tbody>
              {[r.scenarios.d30, r.scenarios.d90].map((s) => (
                <tr key={s.days}><td>{s.days} dias</td><td>{brl(s.p5)}</td><td>{brl(s.median)}</td><td>{brl(s.p95)}</td><td>{pct(s.probLoss, 0)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="muted" style={{ margin: 0 }}>Sem dado: {r.scenarios.note}</p>}
        <p className="src" style={{ marginTop: 8 }}>{r.scenarios.premises}</p>
      </section>

      <section className="card">
        <h2>Resumo do Relator</h2>
        <pre>{r.report}</pre>
      </section>
    </div>
  );
}
