# Escritório Virtual de Mineração: design (RASCUNHO)

Status: Seções 1 e 2 aprovadas em conversa; Seção 3 (motor de lucratividade, cenários, papel dos 25 agentes) pendente. Nenhum código de produto escrito.
Prompt de origem: `docs/referencia/prompt_claude_mineracao_bitcoin_completo.md`

## Decisões
- Escopo da 1ª entrega: Fase 1, simulação com dados reais (sem dinheiro, sem chaves de compra/saque).
- Stack: tudo em TypeScript (Next.js + React Three Fiber).
- Execução (abordagem A, Vercel Hobby): GitHub Actions roda o ciclo dos agentes a cada 5 min e grava no Postgres (Neon). O Vercel serve o escritório 3D e as rotas de API. Com o painel aberto, coletores de preço e rede rodam ao vivo (15–30 s) para cumprir o frescor de 60 s. O Cron da Vercel (1x/dia) é só rede de segurança.
- Limitação assumida: não é 24h/1 min reais. Migrar para worker externo depois é possível porque os agentes ficam independentes do Vercel.

## Seção 1: Estrutura e fluxo
```
app/                  Next.js: escritório 3D + rotas de API (live, state, cron)
src/agents/           25 agentes, 1 arquivo cada, mesma interface
src/intelligence/     motor de lucratividade, Monte Carlo, anomalias, golpes
src/guardian/         limites rígidos + config assinada (somente leitura p/ agentes)
src/bus/              mensagens tipadas (Zod), eventos
src/db/               schema e migrações (Drizzle + Neon)
src/sources/          clientes de API (mempool.space, corretora BR, 2ª fonte)
scripts/run-cycle.ts  um ciclo completo (usado pelo GitHub Actions)
.github/workflows/    cron a cada 5 min + CI com testes
```
Ciclo: coletores (2, 3, 4) gravam `market_snapshots` com fonte/horário/idade → Guardião (14) checa frescor e divergência e define o estado global → Analista (5) calcula margem, equilíbrio e 3 cenários → demais agentes publicam eventos (Comprador só registra ordens simuladas) → API alimenta o escritório 3D.

Regras: dado sem frescor aparece como "sem dado"; LLM só nos agentes [L], com JSON validado, e o sistema funciona sem chave de LLM; nenhuma chave de compra/saque nesta fase.

## Seção 2: Banco e contrato de mensagens
Tabelas (Postgres/Neon + Drizzle): `market_snapshots`, `decisions`, `orders` (simuladas), `payouts` e `asset_status` (vazias), `risk_events`, `audit_log` (somente inserção, hash encadeado), `provider_reputation`, `agent_runs`, `system_state` (só Guardião e botão manual escrevem), `events` (barramento).
Detalhes em `secao2_banco_e_contrato.xlsx`.

Contrato: `{ id, origem, destino, tipo, payload, timestamp, correlation_id }`, validado com Zod. Agentes não se chamam diretamente. Propostas do LLM exigem `confianca` (0–1), `dados_usados`, `alternativas_descartadas`; confiança < 0,7 escala ao Diretor e, sem resolução, a ação padrão é pausar. Textos externos entram como `untrusted`.
Limites do Guardião: `guardian.config.json` versionado, assinado por HMAC; o ciclo não roda se a assinatura não bater.

## Pendente
Seção 3, spec final revisado por você, depois plano de implementação.
