export type AgentKind = "C" | "L" | "C+L";
export type Phase1 = "ativo" | "simulado" | "em_espera";

export interface AgentSpec {
  id: number;
  slug: string;
  name: string;
  kind: AgentKind;
  frequency: string;
  role: string;
  phase1: Phase1;
  /** Por que está em espera na Fase 1 (aparece no escritório). */
  waitingReason?: string;
}

/** Os 25 agentes da ideia (seção 7 do prompt completo), com o estado deles na Fase 1. */
export const AGENTS: AgentSpec[] = [
  { id: 1, slug: "diretor", name: "Diretor", kind: "C+L", frequency: "contínua", role: "Orquestra o ciclo, resolve conflitos e escala para o CEO. Em dúvida, a ação padrão é pausar.", phase1: "ativo" },
  { id: 2, slug: "coletor-rede", name: "Coletor de dados da rede", kind: "C", frequency: "1–5 min", role: "Coleta hashrate, dificuldade, ajuste de dificuldade e blocos (mempool.space).", phase1: "ativo" },
  { id: 3, slug: "coletor-hashprice", name: "Coletor de hashprice", kind: "C", frequency: "5 min", role: "Calcula o hashprice próprio a partir dos dados da rede; fonte externa (Hashrate Index) ainda não configurada.", phase1: "ativo" },
  { id: 4, slug: "coletor-preco", name: "Coletor de preço BTC/BRL", kind: "C", frequency: "15–30 s (painel aberto)", role: "Preço em duas fontes, mediana e divergência.", phase1: "ativo" },
  { id: 5, slug: "analista-lucratividade", name: "Analista de lucratividade", kind: "C+L", frequency: "1–5 min", role: "Roda o motor de decisão: margem, ponto de equilíbrio e recomendação.", phase1: "ativo" },
  { id: 6, slug: "comprador-hashrate", name: "Comprador de hashrate", kind: "C", frequency: "sob demanda", role: "Cria ordens. Na Fase 1 só registra ordens simuladas, e só com orçamento definido e aprovado pelo Guardião.", phase1: "simulado" },
  { id: 7, slug: "gestor-ordens", name: "Gestor de ordens", kind: "C", frequency: "1 min", role: "Ajusta e cancela ordens (simuladas na Fase 1).", phase1: "simulado" },
  { id: 8, slug: "monitor-pool", name: "Monitor de pool", kind: "C", frequency: "1–5 min", role: "Saúde da pool (shares, workers, latência).", phase1: "em_espera", waitingReason: "Nenhuma pool conectada (Piloto)" },
  { id: 9, slug: "seletor-pool", name: "Seletor de pool", kind: "C+L", frequency: "1 h", role: "Compara pools da lista aprovada pelo CEO.", phase1: "em_espera", waitingReason: "Lista de pools aprovadas ainda não definida" },
  { id: 10, slug: "monitor-asics", name: "Monitor de ASICs", kind: "C", frequency: "1 min", role: "Temperatura, ventoinhas, hashrate e consumo.", phase1: "em_espera", waitingReason: "Sem ASIC conectado" },
  { id: 11, slug: "tecnico-remoto", name: "Técnico remoto", kind: "C", frequency: "sob demanda", role: "Reinicia e ajusta ASICs dentro da faixa segura.", phase1: "em_espera", waitingReason: "Sem ASIC conectado" },
  { id: 12, slug: "gestor-energia", name: "Gestor de energia", kind: "C", frequency: "1 h", role: "Custo real do kWh com a tarifa informada.", phase1: "ativo", waitingReason: "Aguardando tarifa e consumo informados pelo CEO" },
  { id: 13, slug: "tesoureiro", name: "Tesoureiro", kind: "C", frequency: "15 min", role: "Saldos e pagamentos (somente leitura).", phase1: "em_espera", waitingReason: "Sem carteira ou plataforma conectada" },
  { id: 14, slug: "guardiao-risco", name: "Guardião de risco", kind: "C", frequency: "toda ação + 1 min", role: "Valida tudo: frescor, divergência, limites e pausa geral.", phase1: "ativo" },
  { id: 15, slug: "seguranca", name: "Segurança", kind: "C+L", frequency: "contínua", role: "Confere a config assinada e bloqueia se houver chave com permissão de saque no ambiente.", phase1: "ativo" },
  { id: 16, slug: "auditor", name: "Auditor", kind: "C", frequency: "1 h + diário", role: "Verifica a cadeia de hashes do audit_log.", phase1: "ativo" },
  { id: 17, slug: "contador-app", name: "Contador (DeCripto)", kind: "C+L", frequency: "diária e mensal", role: "Relatórios para a Receita (IN RFB 2.291/2025).", phase1: "em_espera", waitingReason: "Sem pagamentos reais para declarar" },
  { id: 18, slug: "previsor", name: "Previsor", kind: "C", frequency: "1 h", role: "Próximo ajuste de dificuldade e halving, a partir dos dados da rede.", phase1: "ativo" },
  { id: 19, slug: "pesquisador-mercado", name: "Pesquisador de mercado", kind: "L", frequency: "diária", role: "Pesquisa ASICs, hospedagem e regras de plataformas, sempre com fonte e data.", phase1: "em_espera", waitingReason: "Requer ANTHROPIC_API_KEY e busca" },
  { id: 20, slug: "atualizador-ferramentas", name: "Atualizador de ferramentas", kind: "C+L", frequency: "semanal", role: "Verifica versões e abre PR; nunca faz deploy.", phase1: "em_espera", waitingReason: "Workflow semanal ainda não criado" },
  { id: 21, slug: "testador", name: "Testador", kind: "C", frequency: "a cada mudança", role: "Roda testes no CI do GitHub e bloqueia deploy se falhar.", phase1: "ativo" },
  { id: 22, slug: "alertas", name: "Alertas e comunicação", kind: "C", frequency: "sob demanda", role: "Alertas em 3 níveis, sem repetir.", phase1: "ativo" },
  { id: 23, slug: "relator", name: "Relator", kind: "L", frequency: "diária e semanal", role: "Resumo em português; só narra números recebidos, com fonte e horário.", phase1: "ativo" },
  { id: 24, slug: "detector-golpes", name: "Detector de golpes", kind: "C+L", frequency: "sob demanda", role: "Nota 0–100 de plataformas e pools; veto abaixo de 70 ou rendimento fixo garantido.", phase1: "ativo" },
  { id: 25, slug: "simulador", name: "Simulador", kind: "C", frequency: "sob demanda e semanal", role: "Cenários P5/mediana/P95 com histórico real.", phase1: "ativo" },
];
