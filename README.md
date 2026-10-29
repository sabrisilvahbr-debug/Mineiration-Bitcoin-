# Escritório Virtual de Mineração

Aplicação web em que **25 agentes** acompanham mineração de Bitcoin com **dados reais** (cada número traz fonte, horário e idade) num escritório 3D, e **pausam quando a conta dá prejuízo**.

> **Avisos importantes**
> - **Fase 1 = simulação, sem dinheiro.** Nenhuma chave de compra ou de saque existe nesta fase.
> - **Mineração pode dar prejuízo.** O projeto não promete lucro. Com energia residencial, ASIC próprio costuma dar prejuízo; o sistema mostra a conta e recomenda pausar quando não fecha.
> - Máquinas em 3D não mineram. A mineração real vem de hashrate alugado ou de ASICs hospedados (fases seguintes).
> - Nada aqui é aconselhamento financeiro, jurídico ou tributário. No Brasil, ganhos com cripto têm tributação (DeCripto, IN RFB 2.291/2025): consulte um contador.

## O que já funciona (Fase 1)

- **Dados reais** (conferidos ao vivo pelo CI): rede e dificuldade (mempool.space), preço BTC/BRL em **duas fontes** (Mercado Bitcoin e Coinbase) com divergência, histórico diário em BRL, **preço real de aluguel de hashrate** (NiceHash SHA256) e a **margem de alugar vs. hashprice**.
- **Carteira real (só leitura):** cole um endereço BTC de autocustódia e o painel mostra o **total recebido on-chain** — o "total de bitcoins encontrados" real, sem chaves e sem permissão de saque. Veja `docs/CONEXAO-REAL.md`.
- **Motor de lucratividade** (código puro, testado): receita, custo, margem, ponto de equilíbrio, histerese de pausa/retomada, probabilidade de achar bloco.
- **Cenários** pessimista/base/otimista (Monte Carlo com semente fixa, volatilidade do histórico real).
- **Guardião de risco**: frescor dos dados, divergência de preço, limites de gasto, estados `NORMAL / CAUTELA / PAUSADO_RISCO / PAUSADO_MANUAL`, config assinada (HMAC) e trilha de auditoria com hash encadeado.
- **25 agentes** com ficha e status (ativo, simulado ou em espera, sempre com o motivo) no escritório 3D e numa lista pensada para celular.
- **Regra de ouro:** dado sem frescor aparece como **"sem dado"**, nunca como valor velho. Sem custos informados por você, não há conta (nenhuma taxa é presumida).

## Como rodar

Requisitos: Node 22.18 ou superior.

```bash
npm install
npm test               # testes do núcleo
npm run typecheck
npm run dev            # http://localhost:3000
npm run verify:sources # confere ao vivo se as APIs respondem no formato esperado
```

Sem banco, o painel funciona só com dados ao vivo (o histórico e a histerese não persistem).

## Deploy no Vercel (Hobby)

1. No Vercel: **Add New > Project** e importe este repositório.
2. Em **Environment Variables** configure (veja `.env.example`): `CRON_SECRET` (obrigatório para o cron), `GUARDIAN_SECRET`, `PAUSE_SECRET` e, para guardar histórico, `DATABASE_URL` (Neon).
3. Deploy. O Vercel Hobby só permite **cron 1x por dia** (`vercel.json`); o painel atualiza ao vivo a cada 30 s enquanto estiver aberto.

### Histórico a cada 5 minutos (GitHub Actions + Neon)

1. Crie um banco gratuito no [Neon](https://neon.tech) e rode `db/migrations/001_init.sql` no editor SQL.
2. No GitHub: **Settings > Secrets and variables > Actions**. Secrets: `DATABASE_URL`, `GUARDIAN_SECRET`. Variables: `CYCLE_ENABLED=true`, `CYCLE_INPUTS` (ex.: `ph=1&preco=...&taxaPool=...&taxaPlat=...`, com os **seus** números).
3. O workflow `Ciclo dos agentes` roda a cada 5 min e grava no banco. O GitHub pode atrasar execuções em horário de pico.

## Guardião e limites

`guardian.config.json` guarda os limites. **Sem orçamento definido, nenhuma compra é permitida.** Para ativar orçamento, edite `limits` e **assine**:

```bash
GUARDIAN_SECRET="um-segredo-longo-so-seu" npm run guardian:sign
```

Coloque a assinatura gerada em `GUARDIAN_CONFIG_SIG` (Vercel e variável do GitHub). Em `SIMULACAO`, config sem assinatura roda em modo restrito; em `PILOTO` e `ESCALA`, ou com assinatura que não confere, **o ciclo se recusa a rodar**.

Limites de frescor (da ideia original): preço BTC/BRL 60 s; hashprice 15 min; rede 15 min; status de ordens/ASIC 2 min; divergência entre fontes de preço acima de 1,5% pausa compras. Política inicial: pausa com margem ≤ 0%, retomada com margem ≥ 10% por 3 coletas seguidas.

### Botão de pausa geral

O botão **Pausa geral** do painel pede o `PAUSE_SECRET` e grava a pausa no banco (exige `DATABASE_URL`). Enquanto pausado, o estado é `PAUSADO_MANUAL` em todos os ciclos.

## Divergências em relação à ideia original (aprovadas pelo CEO)

1. Ciclo de 5 min via GitHub Actions (e 15–30 s com o painel aberto), em vez de 1–5 min contínuos 24h.
2. Barramento de eventos em tabela (`events`), sem Redis/BullMQ.
3. Vercel + Neon em vez de VPS com backup diário (confira o backup do seu plano do Neon).
4. Sem heartbeat por minuto (serverless): cada ciclo registra `agent_runs`.
5. "72 h sem intervenção" = 72 h de ciclos de 5 min sem falha não tratada.
6. Backend em TypeScript. Banco acessado com SQL direto (`@neondatabase/serverless`), sem ORM.

## O que ainda NÃO existe (honestidade)

- **Compra real** de hashrate (ordens de verdade no NiceHash com a sua chave sem saque): ainda não — as ordens são **simuladas**. O preço de aluguel já é lido ao vivo e, como hoje dá prejuízo, o sistema não compraria mesmo. Próximo bloco quando a margem justificar.
- Pools, ASICs, contador DeCripto e agentes com LLM: **em espera** (aparecem assim no escritório, com o motivo).
- Fonte externa de hashprice (Hashrate Index): usa o cálculo próprio (subsídio + taxas dos últimos 144 blocos).
- Alertas por Telegram/e-mail: só no painel por enquanto.
- Conexão real com o Neon: o código de gravação foi escrito mas **não foi testado contra um banco real** (os testes usam memória). Rode a migração e confira o primeiro ciclo.
- 2FA no painel: necessário antes de qualquer fase com dinheiro.
- Stop-loss por resultado real do dia: na Fase 1 só aparece como probabilidade nos cenários (não há PnL real).

## Estrutura

```
app/                  Next.js: painel + escritório 3D + /api/state, /api/cron, /api/pause
components/           Panel, Office (React Three Fiber), AgentList
src/intelligence/     lucratividade, hashprice, cenários, anomalias, golpes
src/guardian/         frescor, limites, config assinada
src/sources/          mempool.space, preços BTC/BRL, histórico
src/agents/           registry dos 25 agentes, ciclo, relatório
src/store/            memória e Neon
db/migrations/        esquema Postgres
scripts/              run-cycle, verify-sources, sign-config
docs/                 ideia original, design (spec) e plano
.claude/agents/       equipe de 12 agentes que constrói e opera o projeto
```

## Equipe de agentes (Claude Code)

`.claude/agents/` tem os 12 agentes da empresa (gerente-geral, pesquisador, desenvolvedor, web-designer, copywriter, gestor-de-trafego, vendedor, contador, analista, testador, dev-seguranca, atendente). Regras de todos: não inventar números, perguntar quando faltar informação e nada vai ao ar sem o OK do CEO. Não confundir com os 25 agentes de dentro do app.
