# APIs de produtos e pesquisa

A comparação na Devir, Penguin, Gradiva, Guerra & Paz, Relógio d'Água e MBooks mantém a pesquisa existente para descobrir o livro e consulta a WooCommerce Store API pelo slug do produto. Não procura o ISBN no SKU, porque estas lojas utilizam códigos internos. O Bookcover mantém a integração anterior por SKU, onde o código corresponde ao ISBN.

Na Devir, o atributo ISBN da resposta permite confirmar diretamente a edição. Quando a resposta não inclui um ISBN reconhecido, como nas amostras Penguin, a página do produto continua a ter de confirmar a edição pelo analisador existente. Só depois se aceita o preço da API. Identificadores contraditórios, moedas diferentes de EUR e produtos variáveis não são aceites por este adaptador.

Uma associação confirmada entre loja, ISBN, URL e ID do produto fica em memória durante um máximo de 24 horas, com um limite de 200 associações. Durante essa sessão, as atualizações consultam diretamente a API, sem repetir a pesquisa ou a página do livro. Os preços não são guardados nesta associação: são lidos novamente da API. A cache geral de resultados da extensão mantém o seu funcionamento habitual.

Fechar o contexto de comparação, reiniciar o navegador ou expirar a associação pode exigir nova descoberta. Não há armazenamento permanente destas associações nem serviço externo. Uma alteração do ID ou um ISBN contraditório impede reutilizar a confirmação anterior.

Se a API falhar, devolver dados incompletos ou não permitir confirmar o livro, mantém-se a alternativa pelas páginas. A mesma regra se aplica quando a API não disponibiliza o produto. Cancelar a comparação não guarda novas associações.

## Pesquisa Shopify

Presença, Antígona e Kingpin usam a pesquisa pública `/search/suggest.json`, limitada a seis sugestões de produtos, incluindo pesquisa por título, SKU e código de barras. As sugestões apenas descobrem páginas: o preço indicado na sugestão nunca é usado como oferta. A página final continua a ter de confirmar ISBN, preço, moeda e disponibilidade.

Uma resposta vazia ou inválida permite recorrer à pesquisa HTML existente. Respostas HTTP 401, 403 ou 429 interrompem a consulta da loja, sem repetir a pesquisa por HTML. Não são necessários tokens, novas permissões ou cookies de sessão.

A consulta real de 5 de novembro de 2026 devolveu sugestões por ISBN na Presença e Kingpin. Na Antígona, a pesquisa por ISBN ficou vazia, mas a pesquisa pelo título encontrou o livro. Os endpoints `/products/{handle}.js` devolveram HTTP 429 nas três lojas: por isso, não foram ativados para obter preços. A moeda também teria de ser confirmada, pois o preço Shopify depende do mercado. Referências: [pesquisa preditiva](https://shopify.dev/docs/api/ajax/reference/predictive-search) e [API de produtos](https://shopify.dev/docs/api/ajax/reference/product).

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
