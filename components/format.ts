export const usd = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(v);
export const n = (v: number, d = 2) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(v);
export const pct = (v: number, d = 1) => `${n(v, d)}%`;
export const ageTxt = (s: number | null) => (s === null ? "sem dado" : s < 90 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);
