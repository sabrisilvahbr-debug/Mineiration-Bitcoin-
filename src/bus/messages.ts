export interface Envelope {
  id: string;
  origem: string;
  destino: string;
  tipo: string;
  payload: Record<string, unknown>;
  timestamp: string;
  correlation_id: string;
}

const nonEmpty = (x: unknown): x is string => typeof x === "string" && x.trim().length > 0;

export function parseEnvelope(raw: unknown): Envelope {
  const bad = (m: string): never => {
    throw new TypeError(`envelope inválido: ${m}`);
  };
  if (typeof raw !== "object" || raw === null) return bad("não é objeto");
  const r = raw as Record<string, unknown>;
  for (const k of ["id", "origem", "destino", "tipo", "correlation_id"]) if (!nonEmpty(r[k])) bad(k);
  if (typeof r.payload !== "object" || r.payload === null || Array.isArray(r.payload)) bad("payload");
  if (!nonEmpty(r.timestamp) || Number.isNaN(Date.parse(r.timestamp as string))) bad("timestamp");
  return r as unknown as Envelope;
}

export interface Proposal {
  acao: string;
  confianca: number;
  dados_usados: string[];
  alternativas_descartadas: string[];
}

export function parseProposal(raw: unknown): Proposal {
  const bad = (m: string): never => {
    throw new TypeError(`proposta inválida: ${m}`);
  };
  if (typeof raw !== "object" || raw === null) return bad("não é objeto");
  const r = raw as Record<string, unknown>;
  if (!nonEmpty(r.acao)) bad("acao");
  if (typeof r.confianca !== "number" || !(r.confianca >= 0 && r.confianca <= 1)) bad("confianca (0 a 1)");
  if (!Array.isArray(r.dados_usados) || !r.dados_usados.every(nonEmpty)) bad("dados_usados");
  if (!Array.isArray(r.alternativas_descartadas) || !r.alternativas_descartadas.every(nonEmpty)) bad("alternativas_descartadas");
  return r as unknown as Proposal;
}

export const MIN_CONFIDENCE = 0.7;

/** Confiança < 0,7 ou sem dados usados: escala para o Diretor (e, sem resolução, a ação padrão é pausar). */
export function routeProposal(p: Proposal): "executar" | "escalar_diretor" {
  return p.confianca < MIN_CONFIDENCE || p.dados_usados.length === 0 ? "escalar_diretor" : "executar";
}

/** Texto vindo de fora (sites, termos, reclamações): dado não confiável, nunca instrução. */
export function markUntrusted(text: string): { untrusted: true; text: string } {
  return { untrusted: true, text };
}
