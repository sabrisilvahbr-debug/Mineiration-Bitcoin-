export type AgentKind = "C" | "L" | "C+L";
export type Phase = "ativo" | "simulado" | "em_espera";
export interface AgentSpec { id: number; slug: string; name: string; kind: AgentKind; role: string; phase1: Phase; waitingReason?: string; }

/** Os 25 agentes de trading (ver prompt). Fase 1 = paper trading com dados reais. */
export const AGENTS: AgentSpec[] = [
  { id: 1, slug: "diretor", name: "Diretor", kind: "C+L", role: "Orquestra, resolve conflitos, escala. Em dúvida, não operar.", phase1: "ativo" },
  { id: 2, slug: "coletor-cotacoes", name: "Coletor de cotações", kind: "C", role: "Preço e candles reais (Coinbase), com fonte e horário.", phase1: "ativo" },
  { id: 3, slug: "coletor-macro", name: "Coletor de dados macro", kind: "C", role: "Juros, câmbio, índices.", phase1: "em_espera", waitingReason: "Fonte macro ainda não ligada" },
  { id: 4, slug: "coletor-fundamentos", name: "Coletor de fundamentos", kind: "C+L", role: "Balanços e indicadores.", phase1: "em_espera", waitingReason: "Sem ativos de renda variável conectados" },
  { id: 5, slug: "coletor-noticias", name: "Coletor de notícias/sentimento", kind: "L", role: "Resume notícias; dado não confiável.", phase1: "em_espera", waitingReason: "Requer LLM e feeds" },
  { id: 6, slug: "analista-tecnico", name: "Analista técnico", kind: "C", role: "Médias, RSI, volatilidade.", phase1: "ativo" },
  { id: 7, slug: "analista-quant", name: "Analista quantitativo", kind: "C", role: "Sinais estatísticos e regime de volatilidade.", phase1: "ativo" },
  { id: 8, slug: "gerador-estrategias", name: "Gerador de estratégias", kind: "C+L", role: "Propõe regras; só valem após backtest fora da amostra.", phase1: "ativo" },
  { id: 9, slug: "guardiao-risco", name: "Guardião de risco", kind: "C", role: "Risco por operação, stop diário, drawdown, exposição, sem alavancagem.", phase1: "ativo" },
  { id: 10, slug: "dimensionador", name: "Dimensionador de posição", kind: "C", role: "Tamanho por volatilidade-alvo/risco fixo.", phase1: "ativo" },
  { id: 11, slug: "executor", name: "Executor de ordens", kind: "C", role: "Paper trading; real só com aprovação e chave sem saque.", phase1: "simulado" },
  { id: 12, slug: "gestor-ordens", name: "Gestor de ordens", kind: "C", role: "Acompanha, ajusta e cancela ordens.", phase1: "simulado" },
  { id: 13, slug: "tesoureiro", name: "Tesoureiro/Carteira", kind: "C", role: "Saldo, posições e P&L real (só leitura).", phase1: "ativo" },
  { id: 14, slug: "conciliador", name: "Conciliador/Auditor", kind: "C", role: "Bate ordens x corretora; cadeia de hashes.", phase1: "ativo" },
  { id: 15, slug: "monitor-mercado", name: "Monitor de mercado", kind: "C", role: "Circuit breaker, halt, volatilidade anômala.", phase1: "ativo" },
  { id: 16, slug: "backtester", name: "Backtester", kind: "C", role: "Backtest com custos, out-of-sample e walk-forward.", phase1: "ativo" },
  { id: 17, slug: "detector-overfitting", name: "Detector de overfitting/golpes", kind: "C+L", role: "Veta curve-fit e plataformas nota < 70.", phase1: "ativo" },
  { id: 18, slug: "previsor", name: "Previsor/Cenários", kind: "C", role: "Monte Carlo, VaR, probabilidade de drawdown.", phase1: "ativo" },
  { id: 19, slug: "contador", name: "Contador", kind: "C+L", role: "Rascunho day trade/swing (DARF).", phase1: "em_espera", waitingReason: "Sem operações reais para tributar" },
  { id: 20, slug: "seguranca", name: "Segurança", kind: "C+L", role: "Rotação de chaves; bloqueia chave com permissão de saque.", phase1: "ativo" },
  { id: 21, slug: "pesquisador", name: "Pesquisador de mercado", kind: "L", role: "Due diligence com fonte e data.", phase1: "em_espera", waitingReason: "Requer LLM e busca" },
  { id: 22, slug: "testador", name: "Testador", kind: "C", role: "Roda testes; bloqueia deploy se falhar.", phase1: "ativo" },
  { id: 23, slug: "relator", name: "Relator", kind: "L", role: "Resumo diário; só narra números recebidos.", phase1: "ativo" },
  { id: 24, slug: "alertas", name: "Alertas e comunicação", kind: "C", role: "Telegram/e-mail em 3 níveis.", phase1: "ativo" },
  { id: 25, slug: "simulador", name: "Simulador (paper trading)", kind: "C", role: "Opera a estratégia ao vivo com dinheiro fictício.", phase1: "ativo" },
];
