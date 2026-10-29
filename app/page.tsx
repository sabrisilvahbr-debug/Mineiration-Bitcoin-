"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CycleResult } from "../src/agents/cycle.ts";
import Panel from "../components/Panel.tsx";
import { AgentCard, AgentList, Legend } from "../components/AgentList.tsx";
import { num } from "../components/format.ts";

const Office = dynamic(() => import("../components/Office.tsx"), {
  ssr: false,
  loading: () => <p style={{ color: "#93a1b5", padding: 16 }}>Carregando escritório 3D…</p>,
});

const FIELDS: Array<[string, string, string]> = [
  ["ph", "PH/s (hashrate)", "ex.: 1"],
  ["preco", "Preço por PH/s/dia (R$)", "do provedor"],
  ["taxaPool", "Taxa da pool (%)", "da sua pool"],
  ["taxaPlat", "Taxa da plataforma (%)", "do provedor"],
  ["kw", "ASIC: kW (opcional)", ""],
  ["tarifa", "ASIC: tarifa R$/kWh", ""],
  ["hosp", "ASIC: hospedagem R$/dia", ""],
  ["manut", "ASIC: manutenção R$/dia", ""],
];

export default function Home() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [data, setData] = useState<{ result: CycleResult; inputErrors: string[]; durable: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"3d" | "lista">("3d");
  const [selected, setSelected] = useState<number | null>(null);
  const formRef = useRef(form);
  formRef.current = form;

  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries(formRef.current).filter(([, v]) => v.trim() !== ""));
    try {
      const res = await fetch(`/api/state?${qs.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (e) {
      setError(`Não consegui atualizar: ${(e as Error).message}. Mostrando o último estado recebido.`);
    }
  }, []);

  useEffect(() => {
    const init: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((v, k) => { init[k] = v; });
    setForm(init);
    formRef.current = init;
    void load();
    const t = setInterval(() => void load(), 30_000);
    return () => clearInterval(t);
  }, [load]);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    const qs = new URLSearchParams(Object.entries(form).filter(([, v]) => v.trim() !== ""));
    window.history.replaceState(null, "", qs.toString() ? `?${qs}` : window.location.pathname);
    void load();
  };

  const pause = async () => {
    const token = window.prompt("Token de pausa (PAUSE_SECRET):");
    if (!token) return;
    const paused = window.confirm("OK = PAUSAR tudo. Cancelar = retomar.");
    const res = await fetch("/api/pause", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, paused }) });
    const j = await res.json().catch(() => ({}));
    window.alert(res.ok ? (j.paused ? "Pausa geral ativada." : "Pausa geral removida.") : `Não foi possível: ${j.error ?? res.status}`);
    void load();
  };

  const r = data?.result;
  const sel = r?.agents.find((a) => a.id === selected) ?? null;
  const hashLabel = r?.network.ok ? `${num(r.network.value.networkEhs, 0)} EH/s na rede` : "sem dado da rede";

  return (
    <main>
      <div className="top">
        <h1>Escritório Virtual de Mineração</h1>
        <button type="button" className="danger" onClick={pause}>Pausa geral</button>
      </div>
      <div className="disclaimer">
        Fase 1: simulação com dados reais, sem dinheiro. Mineração pode dar prejuízo; nada aqui é aconselhamento financeiro, jurídico ou tributário.
        Números sem fonte e horário não são exibidos.
      </div>
      {error && <p className="notice">{error}</p>}
      {data && !data.durable && <p className="muted" style={{ margin: 0 }}>Sem banco configurado (DATABASE_URL): o histórico e a histerese não persistem entre atualizações.</p>}
      {!r && !error && <p className="muted">Carregando dados reais…</p>}
      {r && (
        <div className="grid">
          <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section className="card">
              <h2>Seus custos (só você informa)</h2>
              <form onSubmit={apply}>
                {FIELDS.map(([k, label, ph]) => (
                  <label key={k}>{label}
                    <input inputMode="decimal" placeholder={ph} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                  </label>
                ))}
                <label>Método da pool
                  <select value={form["metodo"] ?? "FPPS"} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
                    <option>FPPS</option><option>PPLNS</option><option>SOLO</option>
                  </select>
                </label>
                <button type="submit" style={{ alignSelf: "end" }}>Calcular</button>
              </form>
              {data?.inputErrors.map((x) => <p key={x} className="notice" style={{ margin: "8px 0 0" }}>{x}</p>)}
              <p className="src" style={{ marginTop: 8 }}>Nenhuma taxa ou custo é presumido: sem estes campos não há conta.</p>
            </section>
            <Panel r={r} />
          </div>
          <div className="col-office" style={{ display: "grid", gap: 16, alignContent: "start" }}>
            <section>
              <div className="tabs" role="tablist">
                <button type="button" className={view === "3d" ? "" : "secondary"} onClick={() => setView("3d")}>Escritório 3D</button>
                <button type="button" className={view === "lista" ? "" : "secondary"} onClick={() => setView("lista")}>Lista dos 25 agentes</button>
              </div>
              {view === "3d" ? (
                <div className="office"><Office agents={r.agents} hashrateLabel={hashLabel} selectedId={selected} onSelect={setSelected} /></div>
              ) : (
                <AgentList agents={r.agents} selectedId={selected} onSelect={setSelected} />
              )}
              <Legend />
            </section>
            {sel ? <AgentCard agent={sel} /> : <p className="muted" style={{ margin: 0 }}>Toque em um agente para ver a ficha, o estado atual e os limites.</p>}
          </div>
        </div>
      )}
    </main>
  );
}
