# Monitorização real das lojas

O processo **Verificação das páginas das lojas** arranca de hora a hora, ao minuto 17 UTC. Cada um dos 27 adaptadores tem um período diário estável, ficando uma ou duas lojas por hora. Uma execução só consulta esse período, sequencialmente. Não há uma consulta completa a cada alteração: a CI de PRs e do ramo principal usa amostras guardadas.

Cada loja começa após um atraso aleatório de 0 a 120 segundos. Cada pedido tem mais um atraso de 1 a 3 segundos. Isto reduz rajadas; não contorna controlos de acesso nem garante que uma loja aceite tráfego do GitHub.

A escolha do período usa a hora de criação da execução, não a hora em que sai da fila. Os agendamentos do GitHub podem atrasar ou falhar; um período perdido não é repetido em lote. Execuções manuais usam o período atual e repetir uma execução repete o respetivo período.

## O que é verificado

O adaptador `compareStore` procura o ISBN de exemplo e o `sampleTitle` opcional. Para passar, tem de devolver um preço inteiro positivo numa moeda permitida, URL da mesma loja que corresponda ao padrão de produto, e uma página com o ISBN esperado e preço legível. Alterações de preço e falta de stock são permitidas. Fontes exclusivamente manuais e entradas de referência ficam de fora.

A comparação tem limite de 60 segundos e a verificação do produto de 15 segundos. O comando horário tem limite de 13 minutos e a tarefa de 15 minutos. O verificador só tem leitura do repositório, Actions e issues; apenas a tarefa separada de relatório recebe `issues: write`. Não exige segredos adicionais.

## Erros e pausas

| Identificador             | Significado                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| `access-blocked`          | Bloqueio suave (ex.: HTTP 202 ou 405 anti-bot); sem repetição imediata |
| `rate-limited`            | HTTP 429; sem repetição imediata                                       |
| `authentication-required` | HTTP 401; sem repetição imediata                                       |
| `access-forbidden`        | HTTP 403; sem repetição imediata                                       |
| `method-not-allowed`      | Legado; HTTP 405 passa a `access-blocked`                              |
| `shop-server-error`       | HTTP 5xx                                                               |
| `network-error`           | Pedido falhado ou tempo excedido                                       |
| `page-missing`            | HTTP 404 ou 410                                                        |
| `pattern-unverified`      | Não foi possível confirmar uma oferta                                  |
| `invalid-offer`           | Preço ausente/inválido ou moeda inesperada                             |
| `product-pattern`         | URL fora do padrão de produto da loja                                  |
| `page-detection`          | Página sem o ISBN esperado                                             |
| `request-failed`          | Falha sem prova mais específica                                        |

Um HTTP 403, por si só, não demonstra limitação de frequência. Um HTTP 202 sem oferta verificável é classificado como `access-blocked` (bloqueio suave), não como falha de extração. HTTP 405 (ex.: Almedina no runner) também é `access-blocked`. HTTP 5xx, incluindo 520, continua a ser `shop-server-error`.

Após 202/401/403/405/429, não há mais pedidos à mesma origem nessa execução, incluindo alternativas do adaptador. `Retry-After` também interrompe pedidos e define uma pausa, aceitando segundos ou uma data HTTP. Um 429 sem esse cabeçalho impõe 24 horas de pausa. O estado fica na issue gerida pelo bot e é lido nas consultas seguintes. Uma loja ignorada por estar em pausa não é considerada recuperada.

Outras falhas permitem no máximo uma repetição após 20 a 40 segundos aleatórios, desde que não exista pausa pedida pela loja. Não há contorno de captchas nem pedidos de afiliado.

## Acompanhamento de falhas

Uma única issue do bot acompanha as falhas pendentes. Cada execução só altera lojas efetivamente verificadas. Um período bem-sucedido não elimina falhas de outros períodos. A issue fecha quando todas as lojas anteriormente em falha passam; uma nova falha volta a abri-la. Relatórios ausentes ou incompletos mantêm as falhas existentes e assinalam o problema do verificador.

Um comentário JSON codificado guarda o estado e as pausas. São dados codificados, não encriptados nem executáveis. O relatório migra as linhas da issue antiga que verificava o catálogo completo. Não cria uma issue ou comentário novo a cada hora.

A tarefa de relatório só atualiza a issue do bot depois do checkout e com o artefacto `work/store-health.json` presente; sem um destes, a issue fica inalterada.

O artefacto `store-health` é conservado durante 14 dias. Contém ISBN de exemplo, URLs, códigos HTTP, tipos de erro, datas de pausa e resultados das repetições. Exclui HTML, cookies e outros cabeçalhos de resposta.

## Reprodução local

Executa primeiro `npm ci` e `npx playwright install chromium`.

- `npm run test:live`: período horário atual, com atrasos aleatórios.
- `npm run test:live -- wook`: uma loja.
- `npm run test:live -- wook bookcover`: lojas escolhidas, sequencialmente.
- `npm run test:live -- --all`: consulta completa explícita, nunca usada pela CI agendada.

As execuções locais não importam automaticamente as pausas guardadas no GitHub. Evita repetições durante uma pausa pedida pela loja. Inspeciona `work/store-health.json` antes de atribuir a falha ao analisador. Ao alterar a análise, acrescenta uma amostra mínima e executa `npm run test:coverage` e `npm run test:integration`.

Referências HTTP: [429](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/429) e [Retry-After](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After).
