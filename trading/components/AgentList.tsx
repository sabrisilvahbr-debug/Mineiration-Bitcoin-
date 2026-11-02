import type { AgentRuntime } from "../src/agents/dashboard.ts";
import { AGENTS } from "../src/agents/registry.ts";

const LABEL: Record<string, string> = { trabalhando: "trabalhando", simulado: "paper", alerta: "alerta", ocioso: "ocioso", pausado: "pausado", em_espera: "em espera" };

export function Legend() {
  const items: Array<[string, string]> = [["trabalhando", "#35c07f"], ["simulado", "#4c8dff"], ["alerta", "#d9a441"], ["pausado", "#ff6b6b"], ["em_espera", "#4b5563"]];
  return (<div className="legend">{items.map(([s, c]) => (<span key={s}><i style={{ background: c }} />{LABEL[s]}</span>))}</div>);
}

export function AgentList({ agents, selectedId, onSelect }: { agents: AgentRuntime[]; selectedId: number | null; onSelect: (id: number) => void }) {
  return (
    <div className="agents">
      {agents.map((a) => (
        <button key={a.id} type="button" className="agent" onClick={() => onSelect(a.id)} aria-pressed={selectedId === a.id} style={selectedId === a.id ? { borderColor: "var(--accent)" } : undefined}>
          <span className={`dot s-${a.status}`} aria-hidden />
          <span><b>{a.id}. {a.name}</b> <span className="muted">· {LABEL[a.status]}</span><span className="src">{a.detail}</span></span>
        </button>
      ))}
    </div>
  );
}

export function AgentCard({ agent }: { agent: AgentRuntime }) {
  const spec = AGENTS.find((s) => s.id === agent.id);
  return (
    <div className="card">
      <h2>{agent.id}. {agent.name} <span className="muted">[{spec?.kind}]</span></h2>
      <p style={{ margin: "0 0 6px" }}>{spec?.role}</p>
      <p style={{ margin: 0 }}><b>Agora:</b> {LABEL[agent.status]}. {agent.detail}</p>
      <p className="muted" style={{ margin: "6px 0 0" }}>Fase 1: {spec?.phase1 === "ativo" ? "ativo" : spec?.phase1 === "simulado" ? "simulado (paper)" : "em espera"}</p>
    </div>
  );
}
