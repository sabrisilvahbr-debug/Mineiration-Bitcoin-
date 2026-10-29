# Escritório Virtual de Mineração: design (RASCUNHO)

Fonte da ideia (do CEO): `docs/prompts/prompt_claude_mineracao_bitcoin_completo.md`. Este design só detalha o que está nela; onde divergir, a divergência está listada em "Alinhamento com a ideia" e precisa do OK do CEO.

> Status: **aprovado pelo CEO em bloco** (Seções 1 a 4 e as 6 divergências). Implementação da Fase 1 em andamento.
> Nada aqui é aconselhamento financeiro, jurídico ou tributário.

## Decisões já tomadas

- Escopo da primeira entrega: **Fase 1, simulação com dados reais** (sem gasto de dinheiro).
- Stack: Next.js (App Router) + React Three Fiber + agentes em TypeScript, Postgres (Neon) com Drizzle ORM.
- Hospedagem: Vercel **Hobby**. O Cron da Vercel roda no máximo 1x por dia.
- Abordagem A: GitHub Actions (a cada 5 min) roda o ciclo dos agentes e grava no Neon. Com o painel aberto, os coletores de preço e de rede rodam ao vivo (15–30 s) para cumprir o frescor de 60 s.
- Princípio: **código calcula, LLM propõe, Guardião decide.**
- Nesta fase só há APIs públicas, sem chaves de compra ou saque.

## Seção 1: Estrutura e fluxo de dados

```
app/                  Next.js (App Router): escritório 3D + rotas de API
  api/live            coleta ao vivo (preço, rede) com cache curto
  api/state           estado dos 25 agentes, decisões, cenários
  api/cron            rede de segurança (Vercel Cron, 1x/dia)
src/agents/           registry dos 25 agentes + implementação dos que rodam na Fase 1
src/intelligence/     motor de lucratividade, Monte Carlo, anomalias, golpes
src/guardian/         limites rígidos + config assinada (somente leitura p/ agentes)
src/bus/              mensagens tipadas (schemas Zod), eventos
src/db/               schema e migrações (Drizzle + Neon Postgres)
src/sources/          clientes de API (mempool.space, corretora BR, 2ª fonte)
scripts/run-cycle.ts  roda um ciclo completo (usado pelo GitHub Actions)
.github/workflows/    cron a cada 5 min + CI com testes
docs/superpowers/specs/  este design
```

Fluxo de um ciclo:

1. Os coletores (2, 3, 4) buscam dados reais e gravam `market_snapshots` com fonte, horário e idade.
2. O Guardião (14) checa frescor e divergência de preço e define o estado global (`NORMAL / CAUTELA / PAUSADO_RISCO`).
3. O Analista (5) calcula margem, ponto de equilíbrio e os 3 cenários com o motor de código.
4. Os demais agentes publicam eventos no barramento. Na Fase 1 não há compra real: o Comprador (6) só registra ordens simuladas em `decisions`.
5. A API entrega o estado ao escritório 3D, e o painel mostra tudo com fonte e horário.

Regras gerais:

- Dado sem frescor aparece como "sem dado", nunca como valor antigo.
- O LLM só entra nos agentes marcados [L] e só devolve JSON validado. Sem chave configurada, esses agentes ficam em modo "sem LLM" e o sistema continua funcionando.
- Nenhuma chave de compra ou saque existe nesta fase.

## Seção 2: Banco de dados e contrato de mensagens

Banco: Postgres no Neon (plano gratuito), Drizzle ORM, migrações versionadas. A planilha `docs/secao2_banco_e_contrato.xlsx` detalha as tabelas.

| Tabela | Conteúdo |
|---|---|
| `market_snapshots` | Uma coleta por registro: tipo, valor, fonte, `collected_at`, idade em segundos, flag `stale`. |
| `decisions` | Contexto, proposta, validação do Guardião, resultado medido 24 h depois, `confidence`, `dados_usados`. |
| `orders` | Ordens simuladas na Fase 1, já no formato das ordens reais. |
| `payouts`, `asset_status` | Previstas no schema, vazias na Fase 1. |
| `risk_events` | Pausas, divergências, dado velho, com causa e quem acionou. |
| `audit_log` | Somente inserção, com hash encadeado. O Auditor (16) verifica a cadeia. |
| `provider_reputation` | Nota 0–100 por plataforma/pool e a rubrica usada. |
| `agent_runs` | Heartbeat e resultado de cada execução. |
| `system_state` | Estado global. Só o Guardião e o botão manual escrevem. |
| `events` | Barramento de eventos consumido em ordem dentro do ciclo. |

Contrato de mensagens (schemas Zod, validados na entrada e na saída):

```
{ id, origem, destino, tipo, payload, timestamp, correlation_id }
```

- Agentes não se chamam diretamente: publicam eventos no barramento.
- Toda proposta do LLM traz `confianca` (0–1), `dados_usados` e `alternativas_descartadas`. Confiança abaixo de 0,7 escala para o Diretor; sem resolução, a ação padrão é pausar.
- Textos externos entram como dado `untrusted`. O LLM nunca executa instruções vindas deles.
- Limites do Guardião ficam em `guardian.config.json`, versionado e assinado com HMAC (segredo só do usuário). Agentes têm acesso somente leitura, e o ciclo se recusa a rodar se a assinatura não bater.

## Alinhamento com a ideia (prompt completo)

Como cada parte da ideia entra neste design:

| Seção da ideia | Onde entra | Situação |
|---|---|---|
| 1. Regras de honestidade | Regras gerais; avisos no painel e no README | Mantida integralmente |
| 2. Código calcula, LLM propõe, Guardião decide | Princípio do design | Mantida |
| 3. Camada de Inteligência (3.1 a 3.6) | `src/intelligence/` | Detalhar na Seção 3 |
| 4. Fontes de dados | `src/sources/` | Fase 1 usa só as públicas (mempool.space, corretora BR + 2ª fonte); NiceHash/Braiins e APIs de ASIC entram no Piloto |
| 5. Frescor dos dados (60 s, 15 min, 2 min, 1,5%) | Guardião | Mantida; valores são ponto de partida, como a ideia diz |
| 6. Arquitetura | Seções 1 e 2 | Ver divergências abaixo |
| 7. Os 25 agentes | `src/agents/` | Fase 1: todos existem; os que dependem de ASIC, compra ou carteira (6, 7, 10, 11, 12, 13) rodam em simulação ou ficam em espera |
| 8. Ciclo automático | `scripts/run-cycle.ts` | Divergência de frequência abaixo |
| 9. Segurança | Guardião, `guardian.config.json` assinado, `untrusted` | Mantida; 2FA do painel entra antes de qualquer fase com dinheiro |
| 10. Fases (Simulação, Piloto, Escala) | Estados globais | Entrega atual = Fase 1 |
| 11. Critérios de aceite | Testes e README | Mantidos, com ressalva sobre as 72 h |
| 12. Como trabalhar | Processo do CEO | Perguntas e aprovação do plano antes de codar |

### Divergências da ideia (precisam do OK do CEO)

1. **Frequência do ciclo:** a ideia pede 1–5 min e 24h/7. Com Vercel Hobby, o ciclo roda a cada 5 min via GitHub Actions (pode atrasar em horário de pico) e ao vivo, a cada 15–30 s, só com o painel aberto. O preço BTC/BRL pode ficar "sem dado" com o painel fechado.
2. **Fila:** a ideia cita BullMQ/Redis ou Temporal. Aqui o barramento é a tabela `events` (funciona sem servidor permanente).
3. **Hospedagem:** a ideia cita VPS ou nuvem com reinício automático e backup diário. Aqui é Vercel + Neon; o backup é o do plano do Neon (verificar o que o plano gratuito inclui).
4. **Heartbeat por minuto e reinício após 3 min de silêncio:** não se aplica a funções serverless. Substituto proposto: registro do `agent_runs` a cada ciclo e alerta se um ciclo não rodar em 15 min.
5. **Critério das 72 h sem intervenção:** testável como "72 h de ciclos de 5 min sem falha não tratada", não como processo contínuo.
6. **Backend:** a ideia aceita Node/TypeScript ou Python; a escolha foi TypeScript.

## Seção 3: Camada de Inteligência, Guardião e os 25 agentes na Fase 1

> Aprovada pelo CEO em bloco ("siga e aprove tudo"), junto com as 6 divergências acima. Valores marcados como **política inicial** são pontos de partida do design, não dados de mercado; ficam em `guardian.config.json` para o CEO ajustar.

### 3.1 Motor de lucratividade (`src/intelligence/profitability.ts`, código puro)
- Receita/dia (BRL) = `PH × hashprice_BTC_por_PH_dia × (1 − taxa_pool) × preço_BTC_BRL`.
- Custo/dia aluguel = `PH × preço_pago_por_PH_dia_BRL × (1 + taxa_plataforma)`. Custo/dia ASIC = `kW × 24 × tarifa + hospedagem + manutenção`.
- Margem = `(receita − custo) / custo`; custo zero ou ausente → margem **indefinida** (nunca 0).
- Ponto de equilíbrio: hashprice mínimo (BTC/PH/dia) e, para ASIC, tarifa máxima (R$/kWh).
- Decisão com histerese: margem ≤ limite de pausa → `pausar`; ≥ limite de retomada por N coletas seguidas → `aumentar` (ou `retomar` se estava pausado); no meio → `manter`. **Política inicial:** pausa 0%, retomada 10%, N = 3.
- Variância: FPPS = estável; PPLNS e solo = oscila. Probabilidade de achar ≥ 1 bloco em D dias = `1 − e^(−144 × D × PH/PH_rede)`.
- **Entradas que só o CEO informa** (nunca inventadas): PH/s simulados, preço por PH/dia, taxas, kW, tarifa. Sem elas, o painel mostra "informe o custo".

### 3.2 Hashprice próprio (`hashprice.ts`)
`sats_por_PH_dia = (recompensa_média_por_bloco_em_sats × 144) / hashrate_rede_em_PH`, com a recompensa média vinda de `mempool.space /api/v1/mining/reward-stats/144` (subsídio + taxas dos últimos 144 blocos).

### 3.3 Cenários (`scenarios.ts`, Monte Carlo com semente fixa)
Simula 30 e 90 dias. Volatilidade do preço e crescimento/volatilidade do hashrate vêm de **séries históricas reais** (candles diários da Coinbase Exchange; série de hashrate do mempool.space). Preço sem tendência (média zero), premissa declarada no painel. Saída: P5, mediana, P95 do lucro acumulado, probabilidade de prejuízo e probabilidade de atingir o stop-loss. Sem histórico, os cenários aparecem como "sem dado".

### 3.4 Anomalias (`anomalies.ts`) e golpes (`scamscore.ts`)
- z-score e EWMA sobre séries; alerta de hashrate entregue < contratado; divergência entre fontes de preço.
- Pontuação 0–100 calculada em código a partir de uma rubrica preenchida (pelo LLM ou à mão). Rendimento fixo garantido reprova automaticamente; abaixo de 70 bloqueia.

### 3.5 Guardião (`src/guardian/`)
- Frescor (da ideia, seção 5): preço BTC/BRL 60 s (estourou: pausa compras); hashprice 15 min (usa o próprio; falhou, pausa); rede 15 min (marca "defasado"); status de ordens/ASIC 2 min (3 falhas seguidas pausam); divergência entre fontes de preço > 1,5% (pausa compras).
- Estados: `NORMAL / CAUTELA / PAUSADO_RISCO / PAUSADO_MANUAL`. Sem orçamento definido no config, **nenhuma compra é permitida** (padrão seguro).
- Config assinada com HMAC-SHA256 (`GUARDIAN_SECRET`). Em `SIMULACAO` sem segredo, roda em modo restrito (sem compras) e avisa; em `PILOTO` ou `ESCALA` o ciclo se recusa a rodar se a assinatura não bater.
- Auditoria: `audit_log` com hash encadeado SHA-256; o Auditor verifica a cadeia.

### 3.6 Os 25 agentes na Fase 1
Cada agente tem ficha no registry (`src/agents/registry.ts`): número, nome, tipo [C]/[L]/[C+L], frequência, função e estado na fase. Estados: **ativo** (roda de verdade com dados reais), **simulado** (decide e registra ordem simulada, sem dinheiro) ou **em espera** (precisa de ASIC, chave de plataforma, carteira ou LLM; mostra o motivo no escritório).

| # | Agente | Fase 1 |
|---|---|---|
| 1 | Diretor | ativo (regras: escala e pausa por padrão) |
| 2 | Coletor de rede | ativo |
| 3 | Coletor de hashprice | ativo |
| 4 | Coletor de preço BTC/BRL | ativo |
| 5 | Analista de lucratividade | ativo |
| 6 | Comprador de hashrate | simulado |
| 7 | Gestor de ordens | simulado |
| 8 | Monitor de pool | em espera (sem pool conectada) |
| 9 | Seletor de pool | em espera |
| 10 | Monitor de ASICs | em espera (sem ASIC) |
| 11 | Técnico remoto | em espera (sem ASIC) |
| 12 | Gestor de energia | ativo se o CEO informar tarifa; senão em espera |
| 13 | Tesoureiro | em espera (sem carteira) |
| 14 | Guardião de risco | ativo |
| 15 | Segurança | ativo (confere config assinada e ausência de chave de saque no ambiente) |
| 16 | Auditor | ativo (cadeia de hash) |
| 17 | Contador | em espera (sem pagamentos reais) |
| 18 | Previsor | ativo (dificuldade a partir dos dados da rede) |
| 19 | Pesquisador de mercado | em espera (precisa de LLM e busca) |
| 20 | Atualizador de ferramentas | em espera (workflow futuro) |
| 21 | Testador | ativo (CI do GitHub) |
| 22 | Alertas | ativo em log; Telegram/e-mail quando houver chaves |
| 23 | Relator | ativo (texto por modelo, sem LLM; só narra números recebidos) |
| 24 | Detector de golpes | ativo (rubrica manual + pontuação em código) |
| 25 | Simulador | ativo (cenários da 3.3) |

Agentes [L] só funcionam com `ANTHROPIC_API_KEY`; sem ela, ficam "em espera" e o sistema continua.

## Seção 4: Entrega e verificação
- App Next.js: escritório 3D (React Three Fiber), painel em BRL com fonte, horário e idade; avatar por agente com status; clique abre ficha.
- Rotas: `/api/state` (estado completo), `/api/cron` (ciclo, protegido por `CRON_SECRET`).
- `scripts/run-cycle.ts` roda o ciclo no GitHub Actions a cada 5 min; `npm run verify:sources` confere ao vivo o formato de cada API.
- Testes automatizados (Vitest) para: lucratividade, histerese, frescor, limites e config assinada, pontuação de golpes, cadeia de auditoria, Monte Carlo (determinismo), parsers de cada fonte.
- Deploy: o repositório fica pronto para importar no Vercel; o deploy em si é feito pelo CEO (precisa da conta dele).

## Pendente

- Deploy no Vercel (conta do CEO) e configuração dos segredos.
- Piloto e Escala (fases 2 e 3), com orçamento definido pelo CEO.
