# APIs de produtos: Devir e Penguin

A comparação destas duas lojas mantém a pesquisa existente para descobrir o livro e consulta a WooCommerce Store API pelo slug do produto. Não procura o ISBN no SKU, porque estas lojas utilizam códigos internos.

Na Devir, o atributo ISBN da resposta permite confirmar diretamente a edição. Quando a resposta não inclui um ISBN reconhecido, como nas amostras Penguin, a página do produto continua a ter de confirmar a edição pelo analisador existente. Só depois se aceita o preço da API. Identificadores contraditórios, moedas diferentes de EUR e produtos variáveis não são aceites por este adaptador.

Uma associação confirmada entre loja, ISBN, URL e ID do produto fica em memória durante um máximo de 24 horas, com um limite de 200 associações. Durante essa sessão, as atualizações consultam diretamente a API, sem repetir a pesquisa ou a página do livro. Os preços não são guardados nesta associação: são lidos novamente da API. A cache geral de resultados da extensão mantém o seu funcionamento habitual.

Fechar o contexto de comparação, reiniciar o navegador ou expirar a associação pode exigir nova descoberta. Não há armazenamento permanente destas associações nem serviço externo. Uma alteração do ID ou um ISBN contraditório impede reutilizar a confirmação anterior.

Se a API falhar, devolver dados incompletos ou não permitir confirmar o livro, mantém-se a alternativa pelas páginas. A mesma regra se aplica quando a API não disponibiliza o produto. Cancelar a comparação não guarda novas associações.

## Verificação

Os testes determinísticos cobrem identificação por atributo, confirmação pela página, atualização do preço e disponibilidade, expiração, alterações do produto, respostas inválidas e cancelamento. A inspeção real de 5 de novembro de 2026 confirmou respostas JSON com preços nas duas lojas, mas pesquisas diretas por ISBN vazias. Por esse motivo, a implementação usa o slug descoberto na pesquisa existente.

Referência: [WooCommerce Store API, produtos](https://developer.woocommerce.com/docs/apis/store-api/resources-endpoints/products/).

A verificação real do adaptador implementado passou em 5 de novembro de 2026 para Devir (`9789895598762`) e Penguin (`9789895968244`). As consultas por slug devolveram HTTP 200 e o monitor confirmou também o ISBN e a oferta nas páginas finais. Na Devir, a pesquisa por ISBN apresentou candidatos de outras edições e foi necessária a alternativa por título. Esta primeira descoberta ainda pode exigir vários pedidos; a redução aplica-se sobretudo às atualizações com associação já confirmada.
