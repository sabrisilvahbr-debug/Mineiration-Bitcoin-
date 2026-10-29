# Conectar a mineração real (o que só você pode fazer)

Este guia é honesto sobre o que o sistema faz, o que **você** precisa fazer, e o que os dados reais dizem hoje.

## Verdade de agora (dado real, medido pelo CI)

Alugar hashrate SHA256 no NiceHash custa mais do que rende neste momento:

- Preço de mercado para alugar: ~47.000 sats por PH/s por dia.
- Receita (hashprice) por PH/s por dia: ~41.700 sats.
- **Margem bruta ≈ −13%**, antes das taxas de pool e plataforma.

Ou seja: **alugar hashrate hoje dá prejuízo.** Enquanto for assim, o sistema fica pausado e **não gasta nada**. Ele só compraria se a margem virasse positiva e você tivesse definido e assinado um orçamento. O painel mostra essa margem ao vivo, então você não precisa confiar na minha palavra: olhe o número.

## Passo 1 (agora, sem risco): conectar sua carteira

Você não precisa de chave nenhuma para ver resultado real. Cole, no campo **"Carteira BTC"** do painel, o endereço de **autocustódia** que recebe (ou receberá) os pagamentos da mineração.

- O sistema lê o **total recebido on-chain** direto da blockchain (via mempool.space). É o "total de bitcoins encontrados" real.
- É **só leitura**: ninguém move, gasta ou saca nada. O endereço público não dá esse poder a ninguém.
- Enquanto não houver pagamentos, o valor é **0** — e continua 0, nunca um número inventado.

## Passo 2 (quando/se a margem for positiva): operar de verdade

Operar mineração real paga exige coisas que **só você** pode fazer. Eu não crio contas, não digito suas chaves e não movimento dinheiro.

1. **Energia barata ou aluguel com margem.** Com energia residencial (~R$ 0,80/kWh), ASIC próprio dá prejuízo (a tarifa de equilíbrio hoje fica perto de R$ 0,55/kWh). Alugar só compensa se o preço cair abaixo do hashprice. O painel diz quando isso acontece.
2. **Conta na plataforma (você cria).** Ex.: NiceHash para alugar hashrate, ou uma pool (Braiins, F2Pool) se você tiver ASIC.
3. **Chave de API SEM permissão de saque (você gera e cola como segredo).** O sistema recusa operar se detectar uma chave com permissão de saque. Os pagamentos vão sempre para a sua carteira de autocustódia do Passo 1.
4. **Orçamento assinado por você.** Edite `limits` em `guardian.config.json` e rode `GUARDIAN_SECRET="seu-segredo" npm run guardian:sign`. Sem orçamento assinado, nenhuma compra é permitida.
5. **Defina stop-loss e limite diário.** O Guardião pausa tudo se forem atingidos.

Mesmo com tudo isso, o sistema **não promete lucro** e não compra enquanto a conta não fechar. Essa é a proteção principal: no pior caso, ele não gasta.

## O que ainda falta para o Passo 2 (honestidade)

- O cliente de compra real no NiceHash (ordens de verdade, com a sua chave sem saque) **ainda não foi implementado**. Hoje as ordens são **simuladas**. Quando a margem justificar, esse é o próximo bloco de trabalho, com teste de ponta a ponta antes de qualquer centavo.
- Leitura de saldo da conta da plataforma (além da carteira on-chain) também fica para esse momento.
- 2FA no painel é obrigatório antes de operar com dinheiro.

## Resumo

- **Hoje:** conecte a carteira e acompanhe a margem real. Custo zero, risco zero.
- **Quando a margem virar positiva:** você cria conta, gera chave sem saque, assina o orçamento, e aí ligamos a compra real.
- **Nunca:** promessa de lucro, número inventado, ou chave com permissão de saque.
