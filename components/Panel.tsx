import type { DashboardState } from "../src/agents/dashboard.ts";
import { usd, n, pct, ageTxt } from "./format.ts";

export default function Panel({ s }: { s: DashboardState }) {
  return (
    <div className="stack">
      <section className="card">
        <h2>Estado <span className={`badge ${s.state}`}>{s.state.replace("_", " ")}</span> <span className="muted">· {s.mode}</span></h2>
        <div className="kpis" style={{ marginTop: 8 }}>
          <div className="kpi"><div className="l">Patrimônio</div><div className="v mono">{usd(s.equity)}</div></div>
          <div className="kpi"><div className="l">Retorno</div><div className={`v mono ${s.totalReturnPct < 0 ? "bad" : "good"}`}>{pct(s.totalReturnPct, 2)}</div></div>
          <div className="kpi"><div className="l">P&amp;L realizado</div><div className={`v mono ${s.realizedPnl < 0 ? "bad" : "good"}`}>{usd(s.realizedPnl)}</div></div>
          <div className="kpi"><div className="l">Exposição</div><div className="v mono">{pct(s.exposure * 100, 0)}</div></div>
          <div className="kpi"><div className="l">Capital inicial</div><div className="v mono">{usd(s.startEquity)}</div></div>
          <div className="kpi"><div className="l">Pode abrir</div><div className="v">{s.canOpen ? "sim" : "não"}</div></div>
        </div>
        {s.reasons.map((x) => <p key={x} className="notice" style={{ margin: "8px 0 0" }}>{x}</p>)}
      </section>

      <section className="card">
        <h2>Mercado e sinais (dados reais)</h2>
        {s.products.length === 0 && <p className="muted" style={{ margin: 0 }}>Sem dado de mercado neste ciclo.</p>}
        {s.products.map((p) => (
          <div key={p.product} className="prod">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <b className="mono">{p.product}</b>
              <span className={`sig ${p.signal}`}>{p.signal}</span>
            </div>
            <div className="stat"><span>Preço</span><b className="mono">{usd(p.price)}<span className="src">{p.priceSource} · {ageTxt(p.priceAgeSec)}</span></b></div>
            <div className="stat"><span>SMA 20 / 50</span><b className="mono">{p.sma20 ? n(p.sma20, 0) : "—"} / {p.sma50 ? n(p.sma50, 0) : "—"}</b></div>
            <div className="stat"><span>RSI (14)</span><b className="mono">{p.rsi !== null ? n(p.rsi, 0) : "—"}</b></div>
            <div className="stat"><span>Posição (paper)</span><b className="mono">{p.positionQty > 0 ? `${n(p.positionQty, 4)} · ${p.unrealizedPnl < 0 ? "" : "+"}${usd(p.unrealizedPnl)}` : "—"}</b></div>
            <div className="stat"><span>Ação</span><b>{p.action}<span className="src">{p.actionReason}</span></b></div>
            {p.backtest && (
              <div className="stat"><span>Backtest (real)</span><b className="mono">{pct(p.backtest.returnPct, 1)} vs B&amp;H {pct(p.backtest.buyHoldPct, 1)}<span className="src">DD {pct(p.backtest.maxDrawdownPct, 0)} · {p.backtest.trades} trades · fora da amostra: {p.backtest.approvedOOS ? "aprovada" : "reprovada"}</span></b></div>
            )}
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Guardião de risco</h2>
        <div className="stat"><span>Risco por operação</span><b className="mono">{pct(s.limits.riskPerTrade * 100, 1)}</b></div>
        <div className="stat"><span>Stop diário</span><b className="mono bad">−{pct(s.limits.dailyStopPct * 100, 1)}</b></div>
        <div className="stat"><span>Drawdown máx</span><b className="mono bad">−{pct(s.limits.maxDrawdownPct * 100, 1)}</b></div>
        <div className="stat"><span>Exposição máx</span><b className="mono">{pct(s.limits.maxExposure * 100, 0)}</b></div>
        <div className="stat"><span>Alavancagem</span><b className="mono good">{s.limits.allowLeverage ? "sim" : "não"}</b></div>
      </section>

      <section className="card">
        <h2>Cenários 30 dias (Monte Carlo, retornos reais)</h2>
        {s.scenario30 ? (
          <>
            <div className="stat"><span>Pessimista (P5)</span><b className="mono bad">{pct(s.scenario30.p5Pct, 1)}</b></div>
            <div className="stat"><span>Base (mediana)</span><b className="mono">{pct(s.scenario30.medianPct, 1)}</b></div>
            <div className="stat"><span>Otimista (P95)</span><b className="mono good">{pct(s.scenario30.p95Pct, 1)}</b></div>
            <div className="stat"><span>Prob. de prejuízo</span><b className="mono">{pct(s.scenario30.probLoss * 100, 0)}</b></div>
            <p className="src" style={{ marginTop: 6 }}>Bootstrap de retornos reais. Resultado passado e simulação não garantem o futuro.</p>
          </>
        ) : <p className="muted" style={{ margin: 0 }}>Sem histórico suficiente.</p>}
      </section>

      <section className="card"><h2>Resumo do Relator</h2><pre>{s.report}</pre></section>
    </div>
  );
}
