# Escritório Virtual de Mineração: design (RASCUNHO)

> Status: **rascunho**. As seções 1 e 2 foram aprovadas na conversa. As seções 3 em diante ainda não foram apresentadas. Nenhum código foi escrito.
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
src/agents/           25 agentes, 1 arquivo cada, mesma interface
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

## Pendente

- Seção 3: motor de lucratividade, cenários (Monte Carlo) e os 25 agentes na Fase 1.
- Seção 4 em diante: escritório 3D, testes, CI e deploy.
