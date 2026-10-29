"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardState } from "../src/agents/dashboard.ts";
import type { Screen } from "../components/Office.tsx";
import Panel from "../components/Panel.tsx";
import { AgentCard, AgentList, Legend } from "../components/AgentList.tsx";
import { usd, pct } from "../components/format.ts";

const Office = dynamic(() => import("../components/Office.tsx"), { ssr: false, loading: () => <p style={{ color: "#93a1b8", padding: 16 }}>Carregando escritório 3D…</p> });

function buildScreen(s: DashboardState): Screen {
  const lines: Screen["lines"] = [
    { label: "Estado", value: s.state.replace("_", " "), tone: s.state === "NORMAL" ? "good" : s.state === "CAUTELA" ? "neutral" : "bad" },
    { label: "Patrimônio", value: usd(s.equity) },
    { label: "Retorno", value: pct(s.totalReturnPct, 2), tone: s.totalReturnPct < 0 ? "bad" : "good" },
    { label: "Exposição", value: pct(s.exposure * 100, 0) },
  ];
  const first = s.products[0];
  if (first) lines.push({ label: first.product, value: `${first.signal}`, tone: first.signal === "comprar" ? "good" : first.signal === "vender" ? "bad" : "neutral" });
  return { title: "Escritório de Trading (paper)", lines };
}

export default function Home() {
  const [capital, setCapital] = useState("10000");
  const [data, setData] = useState<{ state: DashboardState; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "lista">("3d");
  const [selected, setSelected] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const capRef = useRef(capital); capRef.current = capital;
  const pauseRef = useRef(paused); pauseRef.current = paused;

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/state?capital=${encodeURIComponent(capRef.current)}&pause=${pauseRef.current ? "1" : "0"}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json()); setError(null);
    } catch (e) { setError(`Não consegui atualizar: ${(e as Error).message}.`); }
  }, []);

  useEffect(() => { void load(); const t = setInterval(() => void load(), 30000); return () => clearInterval(t); }, [load]);

  const s = data?.state;
  const sel = s?.agents.find((a) => a.id === selected) ?? null;

  return (
    <main>
      <div className="top">
        <h1>Escritório de Trading</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input aria-label="Capital" style={{ width: 120 }} value={capital} inputMode="decimal" onChange={(e) => setCapital(e.target.value)} onBlur={() => void load()} />
          <button type="button" className="danger" onClick={() => { setPaused((p) => !p); setTimeout(() => void load(), 50); }}>{paused ? "Retomar" : "Pausa geral"}</button>
        </div>
      </div>
      <div className="disclaimer">Fase 1: paper trading (dinheiro fictício) com dados reais da Coinbase. Trading tem risco; nada aqui promete lucro nem é recomendação de investimento. A conta de paper não é durável (reinicia em cold start do servidor).</div>
      {error && <p className="notice">{error}</p>}
      {data?.errors?.length ? <p className="muted" style={{ margin: 0 }}>Sem dado para: {data.errors.join(" · ")}</p> : null}
      {!s && !error && <p className="muted">Carregando dados reais…</p>}
      {s && (
        <div className="grid">
          <div className="stack"><Panel s={s} /></div>
          <div className="col-office stack">
            <section>
              <div className="tabs" role="tablist">
                <button type="button" className={view === "3d" ? "" : "secondary"} onClick={() => setView("3d")}>Escritório 3D</button>
                <button type="button" className={view === "lista" ? "" : "secondary"} onClick={() => setView("lista")}>Lista dos 25 agentes</button>
              </div>
              {view === "3d" ? (
                <div className="office">
                  <Office agents={s.agents} screen={buildScreen(s)} selectedId={selected} onSelect={setSelected} />
                  <div className="hud" aria-hidden>
                    {buildScreen(s).lines.slice(0, 4).map((l) => (<div key={l.label} className="hud-chip"><span>{l.label}</span><b className={l.tone === "good" ? "good" : l.tone === "bad" ? "bad" : ""}>{l.value}</b></div>))}
                  </div>
                </div>
              ) : (<AgentList agents={s.agents} selectedId={selected} onSelect={setSelected} />)}
              <Legend />
            </section>
            {sel ? <AgentCard agent={sel} /> : <p className="muted" style={{ margin: 0 }}>Toque em um agente para ver a ficha.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
