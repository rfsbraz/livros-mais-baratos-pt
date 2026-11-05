# APIs de produtos e pesquisa

A comparação na Devir, Penguin, Gradiva, Guerra & Paz, Relógio d'Água e MBooks mantém a pesquisa existente para descobrir o livro e consulta a WooCommerce Store API pelo slug do produto. Não procura o ISBN no SKU, porque estas lojas utilizam códigos internos. O Bookcover mantém a integração anterior por SKU, onde o código corresponde ao ISBN.

Na Devir, o atributo ISBN da resposta permite confirmar diretamente a edição. Quando a resposta não inclui um ISBN reconhecido, como nas amostras Penguin, a página do produto continua a ter de confirmar a edição pelo analisador existente. Só depois se aceita o preço da API. Identificadores contraditórios, moedas diferentes de EUR e produtos variáveis não são aceites por este adaptador.

Uma associação confirmada entre loja, ISBN, URL e ID do produto fica em memória durante um máximo de 24 horas, com um limite de 200 associações. Durante essa sessão, as atualizações consultam diretamente a API, sem repetir a pesquisa ou a página do livro. Os preços não são guardados nesta associação: são lidos novamente da API. A cache geral de resultados da extensão mantém o seu funcionamento habitual.

Fechar o contexto de comparação, reiniciar o navegador ou expirar a associação pode exigir nova descoberta. Não há armazenamento permanente destas associações nem serviço externo. Uma alteração do ID ou um ISBN contraditório impede reutilizar a confirmação anterior.

Se a API falhar, devolver dados incompletos ou não permitir confirmar o livro, mantém-se a alternativa pelas páginas. A mesma regra se aplica quando a API não disponibiliza o produto. Cancelar a comparação não guarda novas associações.

## Pesquisa e detalhes Shopify

Presença, Antígona e Kingpin usam a pesquisa pública `/search/suggest.json`, limitada a seis sugestões de produtos, incluindo pesquisa por título, SKU e código de barras. As sugestões apenas descobrem produtos: o preço indicado na sugestão nunca é usado como oferta.

O detalhe `/products/{handle}.js` fornece as variantes, preço e disponibilidade. A extensão seleciona uma única variante com ISBN exato em SKU ou código de barras; identificadores contraditórios ou variantes ambíguas são rejeitados. Quando há apenas uma variante sem ISBN reconhecido, a página tem de confirmar inicialmente a edição. Esta situação foi observada na Antígona. A associação entre ISBN, produto e variante fica em memória até 24 horas, limitada a 200 entradas, sem guardar o preço nessa associação.

A moeda é confirmada através de uma consulta de leitura a `/cart.js`, com `credentials: 'omit'`: não se lê o carrinho pessoal nem se enviam cookies. Só são aceites preços em EUR. A ligação da oferta inclui o identificador da variante confirmada. As respostas `.js` são analisadas como JSON, nunca executadas como código remoto.

Uma resposta vazia ou inválida permite recorrer à pesquisa HTML existente. Respostas HTTP 401, 403 ou 429 interrompem a consulta da loja, sem repetir a pesquisa por HTML. Não são necessários tokens, novas permissões ou cookies de sessão.

A consulta real de 5 de novembro de 2026 devolveu sugestões por ISBN na Presença e Kingpin. Na Antígona, a pesquisa por ISBN ficou vazia, mas a pesquisa pelo título encontrou o livro. Os primeiros pedidos de detalhe por Node devolveram HTTP 429; a repetição num Chromium real e no contexto da extensão devolveu HTTP 200 nas três lojas, sem cabeçalhos personalizados ou cookies na extensão. Na Presença, Node com cabeçalhos observados no Chromium também devolveu 200. Estes resultados não permitem atribuir a diferença a um único cabeçalho. Não é necessário simular cabeçalhos ou abrir separadores nas comparações: os pedidos partem normalmente do contexto de fundo da extensão.

Referências: [pesquisa preditiva](https://shopify.dev/docs/api/ajax/reference/predictive-search) e [API de produtos](https://shopify.dev/docs/api/ajax/reference/product).

## Investigação Wook e Bertrand

Em 5 de novembro de 2026, as pesquisas públicas por ISBN devolveram HTTP 403 num Chromium real com perfil isolado. As páginas iniciais consultadas a partir do contexto da extensão também devolveram HTTP 403, com uma página de bloqueio Cloudflare. Isto impediu inspecionar os recursos da aplicação e validar chamadas de catálogo nesse ambiente. Não demonstra que as lojas estejam indisponíveis para todos os utilizadores, nem que não existam integrações privadas.

Na exploração posterior no navegador integrado visível, ambas as lojas abriram normalmente, sem resolver desafios nem iniciar sessão. A pesquisa de `9789895701124` encontrou _A Criada_, de Freida McFadden, nas duas lojas, com o mesmo identificador de produto `28535345`. As páginas mostraram 19,46 € e stock disponível nesta observação. A Wook apresentou a campanha de devolução em vale; a Bertrand apresentou acumulação de 1,95 € em cartão. Estas vantagens não alteram o preço a pagar agora.

- [Página Wook observada](https://www.wook.pt/livro/a-criada-freida-mcfadden/28535345): JSON-LD `Book` com ISBN e `offers.price`, mas sem `priceCurrency` no bloco observado. Preço em euros e stock estão visíveis na página.
- [Página Bertrand observada](https://www.bertrand.pt/livro/a-criada-freida-mcfadden/28535345): JSON-LD `Book` com ISBN, preço e moeda EUR; disponibilidade online visível separadamente.
- [Consulta de stock Bertrand](https://ws.gbc.pt/pick-collect/#/reserve?isbn=9789895701124): serviço público ligado pela página do livro, que apresentou título, ISBN e quantidades por livraria. Não foi feita qualquer reserva. O serviço distingue condições das lojas físicas das condições online; não foi confirmado como fonte de preço online.

Foram identificados os recursos públicos `cdn.wook.pt/build/32/header.min.js`, `product.min.js`, `cdn.bertrand.pt/build/448/main.min.js` e `ws.gbc.pt/pick-collect/scripts/scripts.045e8119.js`. A leitura direta destes recursos fora do navegador integrado continuou a devolver HTTP 403. Não foi possível extrair e validar endpoints de dados a partir deles. A exploração confirma acesso funcional pela interface neste contexto, mas não demonstra ainda que os pedidos de fundo da extensão consigam reproduzir esse acesso. Os dados estruturados embebidos nas páginas também não são uma API independente de HTML.

Não foi encontrada documentação oficial que confirme uma API pública de preços por ISBN utilizável pela extensão. Os programas de [afiliados Wook](https://www.wook.pt/Afiliados) e [Bertrand](https://www.bertrand.pt/online/afiliados) são canais para solicitar acesso, mas a existência do programa não garante um feed. Os adaptadores existentes mantêm-se; não se acrescentaram endpoints especulativos, serviços de extração externos ou mecanismos para contornar os bloqueios.

Para avançar com uma integração de parceiro, é necessário confirmar disponibilidade de catálogo por ISBN/EAN, preço e moeda, stock, URL de produto, atualização dos dados, condições das campanhas e autorização de utilização numa extensão. O código de afiliado Wook existente serve para atribuição de ligações, não constitui uma credencial de API.

## Integrações que continuam pendentes

| Lojas                                | O que falta                                                                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wook, Bertrand, Porto Editora        | Obter confirmação de API ou feed comercial autorizado, incluindo condições de campanhas.                                                                |
| Auchan, Waterstones, Worten, Cultura | Confirmar acesso e cobertura dos feeds de afiliados. A adesão ao programa não garante um feed de livros.                                                |
| AbeBooks, IberLibro, Amazon          | Aprovação comercial, credenciais e autorização aplicável ao canal extensão. Não incluir segredos no pacote.                                             |
| Snob                                 | Acesso concedido pela loja à API Shopkit.                                                                                                               |
| Continente, Almedina                 | Confirmar acesso autorizado às APIs da plataforma; os indícios de plataforma não bastam.                                                                |
| Mundo Fantasma                       | Já utiliza dados internos Svelte na descoberta; não há contrato público confirmado para substituir a página final.                                      |
| Restantes lojas automáticas          | Ainda não existe alternativa pública validada que justifique alterar o adaptador.                                                                       |
| Google e Apple                       | Exigem integração separada de ofertas digitais, com formato, edição e país explícitos. Não substituir preços de livros em papel.                        |
| Re-Read e restantes destinos manuais | Não está confirmada uma API adequada de stock e preços por ISBN. APIs de vendedores, como OLX e Vinted Pro, não equivalem a pesquisa global de ofertas. |

Uma integração futura com credenciais privadas ou feeds pode exigir um serviço próprio. Esta alteração continua a executar-se apenas no navegador e não acrescenta esse serviço.

## Verificação

Os testes determinísticos cobrem identificação por atributo, confirmação pela página, atualização do preço e disponibilidade, expiração, alterações do produto, respostas inválidas e cancelamento. A inspeção real de 5 de novembro de 2026 confirmou respostas JSON com preços nas duas lojas, mas pesquisas diretas por ISBN vazias. Por esse motivo, a implementação usa o slug descoberto na pesquisa existente.

Referência: [WooCommerce Store API, produtos](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/products/).

A verificação real do adaptador implementado passou em 5 de novembro de 2026 para Devir (`9789895598762`) e Penguin (`9789895968244`). As consultas por slug devolveram HTTP 200 e o monitor confirmou também o ISBN e a oferta nas páginas finais. Na Devir, a pesquisa por ISBN apresentou candidatos de outras edições e foi necessária a alternativa por título. Esta primeira descoberta ainda pode exigir vários pedidos; a redução aplica-se sobretudo às atualizações com associação já confirmada.

A expansão passou também no monitor real para Gradiva (`9789897855320`), Guerra & Paz (`9789895764808`), Relógio d'Água (`9789897837449`) e MBooks (`9789898297839`), na mesma data. Os testes de navegador verificam nas seis lojas a confirmação inicial, a atualização só por API e a recuperação por HTML quando a API falha. Os testes Shopify verificam descoberta, rejeição de outra edição, ignorar preços das sugestões e pesquisa HTML quando a API não encontra candidatos.

O adaptador Shopify completo passou no monitor real para Presença (`9789722378543`), Antígona (`9789726084495`) e Kingpin (`9789895598571`) em 5 de novembro de 2026. O monitor usou o pacote da extensão, confirmou a oferta e verificou também a deteção do ISBN na página final. Os testes determinísticos adicionais cobrem detalhe com MIME `text/javascript`, seleção de variante, moeda, disponibilidade e atualizações pela API sem repetir a descoberta.
