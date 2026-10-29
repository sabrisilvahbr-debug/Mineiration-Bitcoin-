export const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
export const num = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
export const pct = (v: number, d = 1) => `${num(v * 100, d)}%`;
export const clock = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
export function age(iso: string, refIso: string): string {
  const s = Math.max(0, Math.round((Date.parse(refIso) - Date.parse(iso)) / 1000));
  if (Number.isNaN(s)) return "idade desconhecida";
  if (s < 90) return `${s} s`;
  if (s < 5400) return `${Math.round(s / 60)} min`;
  return `${Math.round(s / 3600)} h`;
}
