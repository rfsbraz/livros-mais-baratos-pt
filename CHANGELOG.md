# Registo de alterações

## Por publicar

- Simplificar as comparações e os alvos para usar apenas o preço do livro, removendo regras de entrega e migrando preferências antigas.
- Acrescentar avaliação na loja do navegador, formulário de problemas no GitHub e versão no rodapé. Publicar ligações às três lojas no README.

- Considerar a poupança combinada dos vales Wook no preço equivalente de comparação, com opção ativa por predefinição para desativar e apresentação separada do valor a pagar.

- Deteção de campanhas Wook com devolução em vale, estimativa da poupança combinada e ligação «Saber mais» com afiliado opcional, sem alterar o preço efetivamente pago.

- Preparar a colaboração em código aberto, corrigir a dependência minimatch e acrescentar análises de segurança ao histórico e às dependências.
- Uniformizar documentação, metadados, modelos e textos de colaboração em português de Portugal.
- Alinhar estrutura, estilo, formatação, CI, publicação e manutenção das lojas com a extensão Geocaching; acrescentar pacotes Firefox e Edge com código partilhado.
- Gerar materiais de publicação por loja e sincronizar texto, imagens e notas de versão no Firefox.
- Ler texto alternativo de ISBN sem clonar SVG ou elementos com eventos em atributos.
- Separar as definições dos preços e recolher o campo opcional de título.
- Selecionar seis lojas por predefinição, preservando escolhas guardadas e permitindo repor as seis.
- Mostrar imediatamente preços locais de consultas automáticas, agendadas e manuais, com data e atualização explícita.
- Ativar comparações numa instalação nova com acesso às 26 lojas configuradas, sem abrir o menu ou executar uma ativação adicional.
- Preservar a opção de desativação guardada e atualizar imagens, textos, privacidade e instruções de instalação.
- Detetar páginas de livros e mostrar avisos dispensáveis de ofertas mais baratas, validando edição, stock, condição e moeda.
- Executar comparações automáticas independentemente do menu, com concorrência limitada, cache curta e registo dependente de permissões.
- Alargar o catálogo a 26 adaptadores automáticos, 17 fontes manuais e 17 entradas de referência, abrangendo as lojas e nomes alternativos do inventário.
- Permitir escolher lojas, limitar pedidos paralelos, cancelar e usar o título para descobrir candidatos com ISBN exato.
- Preservar moedas, condição e distinção de vendedores externos nos resultados e histórico.
- Tratar campos ISBN de editoras, hífenes Unicode, preços de venda apresentados e pesquisa Mundo Fantasma.
- Documentar testes reais, falhas de acesso e limitações por loja, com amostras reconstruídas e testes de regressão no navegador.

## [0.1.8](https://github.com/rfsbraz/livros-mais-baratos-pt/compare/v0.1.7...v0.1.8) (2026-11-09)


### Correções

* **alerts:** registo book-alerts quando as permissões ainda não estão prontas ([#83](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/83)) ([8e60eb5](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/8e60eb56fbbec0917a44494e59b2b167987d984c))
* **ci:** stop Release Please bumps failing Prettier on main ([#77](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/77)) ([4925d96](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/4925d96db713be79af29c199e7ce037e8f0827c6))
* **popup:** iniciar comparação ao detetar o ISBN ([#80](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/80)) ([0731cd7](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/0731cd7dcd4256f70942c2f828647852dc909253))
* **release:** drop stale version.txt parallel version file ([#85](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/85)) ([9cfe20a](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/9cfe20a16d166e70d1187ff1f5f1a5042e4c7145))

## [0.1.7](https://github.com/rfsbraz/livros-mais-baratos-pt/compare/v0.1.6...v0.1.7) (2026-11-09)


### Funcionalidades

* **affiliate:** identificador Bertrand nas ligações ([#70](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/70)) ([be11686](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/be1168669d46f8a03be83054ca781cf9ee543be1))
* **metrics:** estatísticas anónimas de desempenho ([#68](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/68)) ([acc56f2](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/acc56f29c88ebc121c5050389b5d20c4f259ffdf))
* **popup:** destacar oferta mais barata ([#64](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/64)) ([d62574b](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/d62574ba559b6eb3d88d5bbb03355a6191822fdb))
* **popup:** recolher alertas na estante ([#63](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/63)) ([9a19c61](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/9a19c61aabfd5f582b55ef75c4220d11948b1d8d))
* Worten automatic ISBN discovery with marketplace limits ([#72](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/72)) ([4841e8b](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/4841e8b4b6528b7aeabe4418d438b9b1fc5c5797)), closes [#71](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/71)


### Correções

* **ci:** require checkout and probe artifact before store-health sync ([#54](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/54)) ([6e61535](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/6e61535a11f70d198e3b6f71154648a7b11791f8))
* **data:** accept only item watch prices ([#62](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/62)) ([f69eb38](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/f69eb380ed3c67b6c307a6eb565456011b45b07b))
* **firefox:** clear AMO warnings for Android minimum and offscreen calls ([#57](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/57)) ([f21935e](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/f21935e17146e360a55b63238aada23231174f15))
* **listing:** demote affiliate to an end footnote ([#49](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/49)) ([6ea0ed5](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/6ea0ed5b4707e680b3d2dcbb61db2e12019d4861))
* **metrics:** preserve anonymous counts and enforce consent ([#73](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/73)) ([9150320](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/915032018ff4de8e9192b376640776fe06f4db59))
* **popup:** count confirmed prices in compare status after cheapest banner ([#66](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/66)) ([de5f366](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/de5f366c79195bebca52c630ddc5056f7aef06a3))
* **popup:** manter progresso durante persistência ([#67](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/67)) ([0ecb36c](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/0ecb36ca6099b74f8f7ea451c3b3f4973c07bc72))
* **stores:** map HTTP 405 anti-bot responses to access-blocked ([#55](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/55)) ([eaf1a58](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/eaf1a581ff07f642d1a3e956f8f51708005f9577))

## [0.1.6](https://github.com/rfsbraz/livros-mais-baratos-pt/compare/v0.1.5...v0.1.6) (2026-11-05)

### Funcionalidades

- **affiliates:** add optional Wook referral links ([1085f72](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/1085f725bb7ae95eb5553cb044d7adeda5247e80))
- **alerts:** detect book pages and show cheaper offers automatically ([74a092d](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/74a092dcd71d8b6ba9de711dc1250111a8157721))
- **alerts:** enable automatic comparisons with install-time permissions ([f0ba2f6](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/f0ba2f68f49a035ae2f4e2516a9a7c2d1fa417bd))
- **cache:** show background prices immediately in the menu ([ab817e3](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/ab817e37624735b422bf84a872b779ca1e78fb34))
- **extension:** add ISBN price comparison and local book tracking ([0ce19cc](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/0ce19cc484230b141da529efbb88bafc9c613fb7))
- **extension:** add price tracking and cross-browser support ([b028ed8](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/b028ed8149dca11f076f1038e383fd17cb813edf))
- **extension:** align architecture and add Firefox and Edge builds ([2dec64f](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/2dec64f7fc89b7a216a94fc50a4b6fbff70e80ae))
- **i18n:** standardize project materials on European Portuguese ([0999847](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/09998478576447e0e923353bf0818a52e3740c36))
- **lojas:** consultar preços por API em nove lojas ([#27](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/27)) ([b39ba41](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/b39ba413c93c02d452d85cc147791af91a62c3f9))
- **métricas:** add Cloudflare Worker endpoint and latency reports ([#43](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/43)) ([e22ba03](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/e22ba03eeb062367d0c9ea3a808ca1e766ee237c))
- **popup:** simplify price comparisons and add store feedback links ([#25](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/25)) ([c5d527d](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/c5d527d4844abfdf0a74cc6edeae8716ab71279a))
- **promotions:** compare Wook voucher equivalents with an opt-out setting ([9f8b16f](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/9f8b16f5372781b9bd3a3cd73246d6e950e3ea7e))
- **promotions:** considerar vales Wook na comparação com opção de desativar ([da56c1c](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/da56c1cf73effc292bb2f900476e379cf4dfa1f8))
- **promotions:** detect Wook voucher terms and explain combined savings ([c1eea0b](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/c1eea0b7aa5d79f811f7ab4f6d920039a84e8adf))
- **promotions:** detetar vales Wook e explicar a poupança combinada ([36d9374](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/36d9374395d2356c71f648602b26a0f40093020a))
- **stores:** align listing assets and publishing with reference extension ([e163e17](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/e163e17518a0abf2401442e0727fa56d23d1c971))
- **stores:** align metadata, assets and publishing with Geocaching ([34c386d](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/34c386d393cc115f2c941a2f0f972b133ac70b83))
- **stores:** expand coverage across the researched bookshops ([957d924](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/957d92411875257c8e12894771e7c733438cdd79))
- **tracking:** add price targets, shipping totals and local history ([5919e2c](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/5919e2cb96400d4e6ff6c62abb1057070074d4b2))
- **ui:** separate settings from the price comparison menu ([0b9b29c](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/0b9b29cdc212c5f6bce69f2c09c2775f2b29b765))

### Correções

- **ci:** pin supported Ubuntu browser test runner ([3f578cf](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/3f578cf08f1e3e5d674ac60fe1d50a216452040b))
- **ci:** require branch protection before dependency auto-merge ([67a7041](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/67a704134834346e11a05805b40e7f566ba54f50))
- **ci:** restore Validar versão workflow on main ([#40](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/40)) ([f2b931c](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/f2b931c061b735a4d2b2e66de32f9a4e6c0424e6))
- **parser:** read ISBN text without cloning retailer elements ([235dae7](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/235dae713c3f8727d153f987018b8afdf51044f2))
- **release:** align Release Please baseline with 0.1.5 ([#39](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/39)) ([9ee4fcc](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/9ee4fcc83bfe60e03d101ec37f045af5f757f595))
- **store-listing:** remove retailer lists from the description ([2c442ec](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/2c442ec9d12c3453958427d76847d1f9f0de65b0))
- **store-listing:** remove retailer lists from the description ([9441e90](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/9441e90939251889ca50af3b1d8d83e5bf59793b))
- **store:** align support email and listing copy ([#34](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/34)) ([d8d49ec](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/d8d49ecc1b4c880338186143490a7dc1bf72d534))
- **stores:** classify soft blocks apart from parser failures ([#42](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/42)) ([a85904d](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/a85904da5dcb7270b7d38ffae288360cc970ec32))
- **wook:** read stock and keep the affiliate id on every link ([#26](https://github.com/rfsbraz/livros-mais-baratos-pt/issues/26)) ([afa4be8](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/afa4be8b3768dda5f62d8f67c4b02a9aaef38019))

### Desempenho

- **stores:** default comparisons to six Portuguese shops ([b4ac15f](https://github.com/rfsbraz/livros-mais-baratos-pt/commit/b4ac15fb58f472297d37c5af0f319f65935f9827))

## 0.1.5

- Acrescentar preços-alvo, verificações agendadas distribuídas no tempo e notificações sem repetições desnecessárias.
- Comparar totais estimados com portes por destino, mínimos de entrega gratuita e campanhas com datas.
- Desenhar gráficos apenas com observações manuais e agendadas desta instalação.
- Preservar alterações simultâneas à estante/histórico e invalidar tarefas pendentes ao apagar dados.

## 0.1.4

- Acrescentar afiliados opcionais, ativos por predefinição, apenas em cliques deliberados em ofertas Wook confirmadas mais baratas.
- Divulgar comissões na interface e nas páginas das lojas; preservar desativações e atribuição existente.

## 0.1.0

- Primeira extensão experimental Chrome, com comparação por ISBN, quatro adaptadores, estante e histórico local de preços observados.
