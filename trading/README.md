# Escritório Virtual de Trading (agentes de IA)

25 agentes operam investimentos com **disciplina e dados reais**, em **paper trading** (dinheiro fictício) na Fase 1, e **param quando não compensa**.

> **Avisos:** não é recomendação de investimento, nem aconselhamento financeiro/jurídico/tributário. Trading tem risco: você pode perder dinheiro. Nada aqui promete lucro. No Brasil, gerir dinheiro de terceiros é regulado pela CVM — isto é para a sua própria conta.

## O que já funciona (núcleo, testado — 26 testes)
- **Dados reais:** candles e preço spot de cripto (Coinbase), com fonte e horário; sem dado fresco → "sem dado".
- **Indicadores** (SMA, EMA, RSI, volatilidade) e **estratégia** determinística (tendência + filtro de RSI).
- **Backtest com custos** (taxa + slippage) e **validação fora da amostra**: estratégia só vale se for positiva e bater comprar-e-segurar no teste.
- **Monte Carlo / VaR** a partir de retornos reais.
- **Guardião de risco:** risco por operação, stop diário, drawdown máximo, exposição máxima, **sem alavancagem**, frescor de preço.
- **Paper trading:** execução simulada com taxa e slippage, posições, P&L, marcação a mercado.
- **25 agentes** no registry, com papel e estado (ativo / simulado / em espera).

## Rodar
```bash
npm install            # (opcional; o núcleo roda só com Node 22+)
npm test               # 26 testes
npm run typecheck
npm run verify:sources # dados reais + backtest ao vivo (precisa de internet)
npm run backtest BTC-USD
```

## O que ainda falta (honestidade)
- Painel 3D/dashboard (o design está no Claude Design); ciclo que liga tudo; execução real (só com sua chave sem saque e aprovação); dados de ações/B3; contador DARF; 2FA. Fase 1 é paper trading.
- Nenhuma estratégia aqui tem lucro garantido. O backtest é ponto de partida, não promessa.

## Princípio
"Código calcula, LLM propõe, Guardião decide." Toda conta de dinheiro e risco é código determinístico e testado.
