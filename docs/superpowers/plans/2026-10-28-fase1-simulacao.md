# Fase 1 (Simulação com dados reais) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o Escritório Virtual de Mineração (Fase 1): 25 agentes, dados reais com fonte/horário/idade, motor de lucratividade, Guardião e escritório 3D, pronto para Vercel Hobby.

**Architecture:** Núcleo em TypeScript puro e testável (`src/intelligence`, `src/guardian`, `src/bus`, `src/sources`, `src/agents`), consumido por rotas Next.js e por `scripts/run-cycle.ts` (GitHub Actions). Armazenamento atrás de uma interface `Store` (memória nos testes, Neon em produção).

**Tech Stack:** Next.js (App Router), React, React Three Fiber + drei, TypeScript strict, Zod, Vitest, Drizzle ORM + Neon, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-28-escritorio-virtual-mineracao-design.md`

## Global Constraints

- Nenhum dado de mercado inventado: tudo vem de API com `source`, `collectedAt` (ISO) e idade; falha de rede ou de formato vira `sem dado`.
- Frescor: preço BTC/BRL 60 s; hashprice 15 min; rede 15 min; status de ordens/ASIC 2 min (3 falhas pausam); divergência de preço > 1,5% pausa compras.
- Política inicial: pausa 0%, retomada 10%, N = 3 coletas.
- Sem orçamento no config, nenhuma compra é permitida. Sem chaves de compra ou saque na Fase 1.
- Conta de dinheiro só em código determinístico; LLM só propõe (e é opcional).
- Textos e UI em português do Brasil; avisos de risco visíveis; nada de promessa de lucro.
- Nada vai para `main` nem para produção sem o OK do CEO; trabalho na branch `docs/design-escritorio-mineracao`.

## Review Focus

1. Resposta de API com formato diferente do documentado → `sem dado` + erro registrado, nunca valor parcial.
2. Preço em uma só fonte (a outra caiu) → compras pausadas, preço exibido com aviso.
3. Custo informado = 0 ou ausente → margem indefinida, nunca "lucro infinito" nem 0%.
4. Relógio/horário no futuro ou idade negativa → tratado como inválido.
5. Config do Guardião adulterada ou sem assinatura em PILOTO/ESCALA → ciclo recusa rodar.

---

### Task 1: Scaffold
**Files:** `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.example`
**Produces:** scripts `test`, `typecheck`, `build`, `cycle`, `verify:sources`.
- [ ] Instalar dependências; `npm test` roda (0 testes) e `npm run typecheck` passa.
- [ ] Commit.

### Task 2: Camada de Inteligência (`src/intelligence/`)
**Files:** `profitability.ts`, `hashprice.ts`, `scenarios.ts`, `anomalies.ts`, `scamscore.ts`; testes em `tests/intelligence/`.
**Produces:**
- `computeRentedEconomics(i: RentedInput): Economics`, `computeAsicEconomics(i: AsicInput): Economics` (`Economics = { revenueBrlDay; costBrlDay; marginPct: number|null; breakEvenHashpriceBtcPerPhDay: number|null; breakEvenTariffBrlKwh?: number|null }`)
- `decide(margins: number[], prev: Action, p: Policy): Action` (`Action = 'pausar'|'manter'|'aumentar'`)
- `soloBlockProbability(ph: number, networkPh: number, days: number): number`
- `hashpriceSatsPerPhDay(avgRewardSatsPerBlock: number, networkPh: number): number`
- `runScenarios(i: ScenarioInput): ScenarioResult | null` (semente fixa; `null` sem histórico)
- `zscore`, `ewma`, `detectUnderDelivery(contracted, delivered, tol)`, `scamScore(r: Rubric): { score; blocked; reasons }`
- [ ] Testes: margem com valores conhecidos à mão; custo 0 → `null`; histerese (meio mantém, 3 seguidas aumentam, ≤ pausa pausa); equilíbrio; probabilidade solo; Monte Carlo determinístico e P5 ≤ mediana ≤ P95; sem histórico → `null`; golpe: rendimento fixo reprova.
- [ ] Implementar; rodar; commit.

### Task 3: Guardião, barramento, auditoria
**Files:** `src/guardian/{freshness,limits,config}.ts`, `src/bus/messages.ts`, `src/audit/chain.ts`, testes.
**Produces:** `evaluateGuardian(snap: MarketView, cfg: GuardianConfig, now: Date, manual: boolean): GuardianVerdict` (`{ state; purchasesAllowed; reasons: string[]; freshness: Record<string, 'ok'|'defasado'|'sem_dado'> }`); `signConfig/verifyConfig`; `Envelope` (Zod); `appendAudit(prevHash, payload, ts)` e `verifyChain(entries)`.
- [ ] Testes: cada limite de frescor (limite exato e +1 s); divergência 1,49% vs 1,51%; sem orçamento bloqueia compras; assinatura válida/ inválida; cadeia detecta adulteração; envelope inválido rejeitado; idade negativa inválida.
- [ ] Implementar; commit.

### Task 4: Fontes e agentes
**Files:** `src/sources/{http,mempool,price,history}.ts`, `src/agents/{registry,cycle}.ts`, `src/store/{store,memory,neon}.ts`, `src/db/schema.ts`, `scripts/{run-cycle,verify-sources}.ts`, testes com respostas de exemplo no formato documentado.
**Produces:** `Reading<T> = { ok: true; value: T; source; collectedAt } | { ok: false; error; source }`; `fetchNetwork()`, `fetchPrices()`, `fetchHistory()`; `runCycle(deps): Promise<CycleResult>`; `AGENTS: AgentSpec[]` (25).
- [ ] Testes: parser aceita o formato documentado e rejeita campo faltando/tipo errado; `fetchPrices` com uma fonte fora devolve preço + `purchases` bloqueadas; registry tem 25 agentes únicos; ciclo com tudo fora produz estado pausado e nenhuma ordem.
- [ ] Implementar; commit.

### Task 5: App
**Files:** `app/{layout,page}.tsx`, `app/api/{state,cron}/route.ts`, `components/{Office,Panel}.tsx`, `vercel.json`, `.github/workflows/{cycle,ci}.yml`.
- [ ] `/api/state` devolve estado com fonte/horário/idade; painel mostra "sem dado" quando for o caso; formulário do CEO para PH, preço por PH/dia, taxas.
- [ ] Escritório 3D com 25 mesas, status por cor + rótulo, ficha ao clicar; fallback em lista no celular.
- [ ] `npm run build` passa; captura de tela confere.

### Task 6: Verificação e entrega
- [ ] `npm test`, `npm run typecheck`, `npm run build` verdes; README (instalação, custos, riscos, pausa, divergências); commit e push na branch.
