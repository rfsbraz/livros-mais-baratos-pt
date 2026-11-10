# Arquitetura

Manifest V3, módulos ES, sem dependências npm em execução nem servidor. O menu gere comparações manuais. Os avisos automáticos usam um processo de segundo plano, scripts registados dinamicamente nas páginas e um documento oculto para analisar o DOM. As consultas agendadas aplicam-se apenas a livros guardados com preços-alvo ativos.

## Avisos automáticos nas páginas

O manifesto declara exatamente as 27 origens configuradas em `host_permissions`. Uma instalação nova usa `autoEnabled !== false` e seis lojas predefinidas, sem escrever preferências nem exigir abertura do menu. Um valor falso guardado mantém os avisos desativados após atualizações e reinícios. O menu verifica permissões existentes, em vez de pedir novo acesso durante a comparação.

O processo regista `content.js` apenas nos sites selecionados e autorizados, incluindo separadores já abertos. Instalação, arranque e alterações de permissões ou preferências atualizam os registos. Desativar ou mudar a configuração fecha o documento de análise, cancela pedidos, descarta a cache e manda remover avisos desatualizados.

O script da página usa os adaptadores de ISBN e preço existentes. Rejeita páginas de pesquisa, vendedores externos, formatos digitais identificados e preços não verificáveis. Observa conteúdo tardio e mudanças de URL, invalida resultados assíncronos antigos e suporta regressos pelo histórico do navegador. Antes de encaminhar metadados do livro, o processo valida o identificador da extensão remetente, a moldura principal, o URL, a loja selecionada/autorizada e os campos da oferta. O HTML completo não sai do separador.

O documento oculto usa os mesmos adaptadores de comparação. Executa no máximo duas tarefas de edição/seleção distintas, com quatro lugares partilhados para lojas, limite de 90 segundos por tarefa e 35 segundos por loja. Pedidos iguais partilham a tarefa. A cache em memória dura dez minutos e tem limite de 50 entradas.

Só uma oferta estritamente mais barata, nova, em EUR, com stock e de outra loja sem vendedores externos gera aviso. O aviso indica hora e diferença, comparando preços do livro e identificando equivalentes condicionados ao uso de vales. Resultados em cache não são observações históricas. Fechar o aviso suprime esse ISBN no documento atual.

## Módulos e correspondência

`stores.js` centraliza adaptadores, permissões, pesquisas, fontes manuais e nomes alternativos. `core.js` valida identificadores, normaliza valores para unidades monetárias inteiras, verifica ligações e limita o histórico. `parser.js` lê DOM inerte e JSON-LD. `compare.js` tenta ISBN e título opcional, visitando até seis candidatos únicos, com limite de 12 segundos por pedido. O menu limita a concorrência a quatro lojas e cada loja a 35 segundos. Identificadores de geração e cancelamento impedem resultados antigos de substituir pesquisas recentes. Comparações interrompidas não guardam histórico parcial. As escritas em armazenamento são serializadas.

Só são aceites ISBN válidos. ISBN-10 é convertido para ISBN-13, incluindo tratamento de hífenes Unicode. O título apenas descobre candidatos; o ISBN continua obrigatório. A associação alternativa entre Book e Product exige ISBN explícito, um único Product e uma página de produto. O preço Open Graph exige página verificada. Um SKU só vale como ISBN nas lojas onde essa equivalência foi observada.

Rejeita `lowPrice` agregado, moedas não permitidas e URLs externos. Algumas lojas internacionais suportam GBP/USD explícitos, sem conversão. Condição e moeda permanecem separadas no histórico. Apenas ofertas novas em EUR, sem vendedores externos e com `InStock` confirmado recebem a indicação de menor preço. Metadados de stock conhecidos como inconsistentes ficam desconhecidos.

## Adaptadores

Wook usa `/pesquisa?keyword={isbn}`, Bertrand `/pesquisa/{isbn}` e ambas usam produtos em `/livro/`. Almedina usa a pesquisa de catálogo e páginas de produto. Wook e Almedina podem redirecionar um ISBN exato para o produto, mantendo a origem da loja. Na Wook, o adaptador valida o ISBN e lê o preço explícito em euros em `#product-price .price`, pois o JSON-LD pode omitir a moeda.

Bookcover usa `/wp-json/wc/store/v1/products?sku={isbn}` e valida SKU, EUR e unidades monetárias; a pesquisa normal não corresponde ao ISBN. Mundo Fantasma usa dados públicos de pesquisa Svelte para descobrir SKU, cria ligações com leitura limitada dos índices e valida independentemente ISBN/preço no produto. Saída de Emergência usa o preço de venda apresentado quando os dados estruturados estão desatualizados. Outros adaptadores associam um ISBN rotulado a um único Product. Ligações de ações de carrinho/estante são rejeitadas. Corpos HTML/JSON têm limite de 4 MB e os scripts recebidos nunca são executados.

Rotas e esquemas podem mudar. Bloqueios ou dados inválidos produzem resultados indisponíveis/não verificados, com ligação manual. Consulta a [cobertura](store-coverage.md). Os testes reais de 3 de novembro de 2026 confirmaram amostras em 18 dos 27 adaptadores; não garantem a totalidade dos catálogos.

## Navegadores, testes e armazenamento

Chrome e Edge usam o processo de serviço e a API [offscreen](https://developer.chrome.com/docs/extensions/reference/api/offscreen). Firefox usa uma página de segundo plano e uma moldura local de análise, com o ponto de entrada de conteúdo empacotado. O [registo dinâmico](https://developer.chrome.com/docs/extensions/reference/api/scripting#method-registerContentScripts) respeita as escolhas guardadas.

Os testes Chromium exercitam a comunicação nativa entre página, processo e documento oculto. Só a fronteira de rede é substituída na cópia temporária, pois o encaminhamento de páginas do Playwright não interceta alvos ocultos. Firefox e Edge têm testes nativos próprios. As amostras são reconstruídas a partir de campos públicos e incluem casos adversariais. `node scripts/live-smoke.mjs` verifica lojas reais, opcionalmente com identificadores de lojas como argumentos. Nenhum código privado é enviado para um serviço externo de navegação.

Resultados confirmados em segundo plano, agendados e manuais ficam em cache local para até 50 ISBN. O menu recupera preços das lojas selecionadas, com a hora. Após dez minutos são sinalizados como possivelmente desatualizados; após 24 horas deixam de aparecer e são removidos na próxima escrita. **Comparar** atualiza explicitamente. Mostrar a cache não cria histórico. Apagar dados remove-a e invalida escritas pendentes. As campanhas Wook são reavaliadas com as condições atuais.

## Materiais de publicação e evolução

`npm run store-listing:assets` gera os pacotes e as capturas reais com dados de demonstração. Os materiais ficam em `store-listing/` e `dist/store-listing`; o ZIP de submissão fica em `dist/`. As páginas públicas de privacidade e apoio ainda precisam de alojamento. Consulta a [automação](../store-listing/AUTOMATION.md).

Valida os adaptadores e as condições das lojas antes de uma distribuição ampla. Usa amostras mínimas com origem e data quando a utilização for permitida. Preços-alvo e gráficos estão descritos [aqui](targets-history.md). Deteção automática de campanhas, detalhe de saldo em cartão e importação de listas continuam por implementar.

## Aspeto visual

Tinta `#172e59`, azul `#2458bb`, branco `#ffffff`, azul-claro `#eef3fc`, cinzento `#536278` e verde `#16624a`. O símbolo representa lombadas de livros. Segoe UI é usada nos controlos e preços; Georgia nos títulos. Preços à direita, lojas à esquerda, numa lista. O foco de teclado é visível e o texto dinâmico das lojas entra através de nós de texto.

## Estatísticas anónimas

A extensão pode enviar lotes agregados de desempenho para o Worker descrito em [metrics.md](metrics.md). A recolha é local (`metrics.js`), sem identificador persistente, e está ativa por predefinição. A escolha explícita fica em `metricsChoice` (`on` | `off`); `metricsEnabled` mantém o valor booleano. Sem escolha guardada aplica-se a predefinição. A migração de `data.js` regista como escolha explícita qualquer `metricsEnabled` já guardado, porque só o interruptor o escrevia.

### Consistência e consentimento das métricas

O processo de background é o único escritor de `metricsPending`. O menu, as páginas e a moldura de análise enviam apenas pontos com dimensões fixas por mensagens internas. Uma fila serializa as alterações locais; durante um envio, os novos contadores ficam guardados para o lote seguinte. Desativar a opção ou apagar os dados cancela o pedido em curso e invalida operações antigas. O limite de 32 KiB inclui o objeto efetivamente persistido; cada pedido respeita também o limite de 249 pontos do recetor.

`metrics-validation.js` valida a mesma lista branca no cliente e no Worker. A cópia de contrato em `tests/fixtures/metrics-schema.json` tem um teste que impede divergências do esquema distribuído. Não são aceites campos adicionais nem valores livres provenientes dos livros.

No Firefox, `permissions.getAll().data_collection` tem de conter `technicalAndInteraction`, além da preferência local estar ativa. O Firefox mostra esta permissão opcional marcada na instalação, pelo que a predefinição local também é ativa. O gesto de ativação pede essa permissão com `permissions.request`; ausência da API, recusa ou erro impedem a recolha. A remoção da permissão apaga os agregados. Este contrato segue a [documentação de consentimento da Mozilla](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/).

`comparison-metrics.js` recebe apenas ids de lojas e estados. Os relógios do menu começam na primeira linha do módulo e no clique em Comparar, respetivamente. Cada loja começa quando obtém um lugar na fila e termina depois de apresentar o resultado. A loja mais lenta é a última a concluir. As comparações automáticas e agendadas usam o mesmo coletor, sem gerar tempos do menu. Cancelar ou fechar o menu fecha a medição uma única vez.

Os testes de navegador intercetam o endpoint e as respostas das lojas. Não fazem envios reais nem alteram práticas de privacidade nos portais das lojas. Os passos manuais em `store-listing/CHROME_UPDATE.md` e `store-listing/EDGE_UPDATE.md` continuam obrigatórios antes da submissão.
