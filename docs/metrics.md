# Métricas anónimas

Este documento descreve o endpoint que recebe os lotes anónimos da extensão, os dados que guarda e as consultas que respondem às perguntas de latência. A recolha na extensão está em #31.

## Endpoint

`POST https://metrics-livros.steamhardwarestock.com/v1/batch`, com `Content-Type: application/json`, corpo de até 32 KB e no máximo 249 pontos.

| Resposta | Quando                                                                 |
| -------- | ---------------------------------------------------------------------- |
| 204      | Lote aceite e escrito, ou resposta ao preflight.                       |
| 400      | Origem não permitida, tipo de conteúdo errado ou lote fora do esquema. |
| 413      | Corpo com mais de 32 KB ou mais de 249 pontos.                         |
| 429      | Limite de pedidos excedido.                                            |

O Analytics Engine aceita 250 escritas por pedido, e o Worker usa uma delas para contar o lote. Um dia com mais de 249 pontos tem de ser enviado em vários pedidos.

## Lote

O esquema está em `metrics-schema.json` e é o mesmo para a extensão e para o Worker. A extensão usa a cópia `metrics-schema.js`, porque o service worker do Chrome não volta a arrancar depois de parar quando importa JSON como módulo; um teste unitário garante que as duas cópias são iguais. Cada valor vem de uma lista fechada ou de um formato estrito, por isso um ISBN, um URL ou um campo desconhecido fazem o lote inteiro ser rejeitado.

```json
{
  "schema": 1,
  "browser": "chrome",
  "version": "0.1.6",
  "day": "2026-11-05",
  "sample_rate": 1,
  "points": [
    {
      "metric": "store_latency",
      "surface": "popup",
      "store": "wook",
      "outcome": "price",
      "bucket": "1000",
      "count": 3
    }
  ]
}
```

O campo `day` é validado e não é guardado. O dia das consultas é o da escrita no servidor.

## Dados guardados

| Coluna    | Conteúdo                                                                |
| --------- | ----------------------------------------------------------------------- |
| `index1`  | `metric`                                                                |
| `blob1`   | `metric`                                                                |
| `blob2`   | `browser`                                                               |
| `blob3`   | `version`                                                               |
| `blob4`   | `surface`                                                               |
| `blob5`   | `store`                                                                 |
| `blob6`   | `outcome`                                                               |
| `blob7`   | `bucket`                                                                |
| `double1` | `count`                                                                 |
| `double2` | `sample_rate`                                                           |
| `double3` | Limite do balde em ms, para os percentis. O balde `inf` fica com 60000. |

Nunca são guardados o IP, o User-Agent, o país (`request.cf` não é lido) nem a hora do cliente. O IP só serve de chave ao limite de pedidos, que usa contadores em memória. O Worker não escreve registos, e o `wrangler.toml` desliga o Logpush e a observabilidade. Os dados ficam no Analytics Engine durante três meses.

Além dos pontos do lote, o Worker escreve um ponto `batch` por lote aceite. Não há identificador de instalação, por isso um lote é a melhor aproximação a uma instalação num dia.

## Consultas

Todas usam a API SQL do Analytics Engine. Em todas, o peso de cada linha é `double1 / double2 * _sample_interval`: a contagem, corrigida pela amostragem na extensão e no Analytics Engine.

Um valor de 60000 num percentil quer dizer "mais de 35 s".

### 1. p50 e p95 dos tempos totais, por navegador e versão

Para os últimos 30 dias, troca `'7'` por `'30'`.

```sql
-- q1
SELECT
  blob1 AS metric,
  blob2 AS browser,
  blob3 AS version,
  quantileExactWeighted(0.5)(double3, toUInt32(double1 / double2 * _sample_interval)) AS p50_ms,
  quantileExactWeighted(0.95)(double3, toUInt32(double1 / double2 * _sample_interval)) AS p95_ms
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND (blob1 = 't_first_result' OR blob1 = 't_all_settled' OR blob1 = 't_compare_settled')
  AND blob6 = 'settled'
GROUP BY metric, browser, version
ORDER BY metric, browser, version
FORMAT JSON
```

### 2. Tempo até ao resultado por loja, com taxas de falha

Os pedidos cancelados (`aborted`) ficam de fora, porque foi o utilizador que os interrompeu.

```sql
-- q2
SELECT
  blob5 AS store,
  quantileExactWeighted(0.5)(double3, toUInt32(double1 / double2 * _sample_interval)) AS p50_ms,
  quantileExactWeighted(0.95)(double3, toUInt32(double1 / double2 * _sample_interval)) AS p95_ms,
  sumIf(double1 / double2 * _sample_interval, blob6 = 'timeout') / sum(double1 / double2 * _sample_interval) AS timeout_rate,
  sumIf(double1 / double2 * _sample_interval, blob6 = 'blocked') / sum(double1 / double2 * _sample_interval) AS blocked_rate,
  sumIf(double1 / double2 * _sample_interval, blob6 = 'error') / sum(double1 / double2 * _sample_interval) AS error_rate
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 'store_latency'
  AND blob6 != 'aborted'
GROUP BY store
ORDER BY p95_ms DESC
FORMAT JSON
```

### 3. Que loja termina em último, e o que o p95 desceria sem ela

Quantas vezes cada loja terminou em último:

```sql
-- q3a
SELECT
  blob5 AS store,
  sum(double1 / double2 * _sample_interval) AS last_finishes
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 'slowest_store'
GROUP BY store
ORDER BY last_finishes DESC
FORMAT JSON
```

O p95 sem cada loja é uma estimativa feita a partir dos histogramas, porque o total de cada comparação não está ligado às suas lojas. Guarda o resultado desta consulta em `q3b.json`:

```sql
-- q3b
SELECT
  blob5 AS store,
  double3 AS bucket_ms,
  sum(double1 / double2 * _sample_interval) AS n
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 'store_latency'
  AND blob6 != 'aborted'
GROUP BY store, bucket_ms
ORDER BY store, bucket_ms
FORMAT JSON
```

Depois calcula a estimativa:

```bash
node scripts/metrics-p95-without-store.mjs < q3b.json
```

A estimativa assume que as lojas são independentes e ignora a fila de quatro pedidos em simultâneo. Serve para ordenar as lojas, não como medição. Compara o resultado com o `t_all_settled` da consulta 1.

### 4. Lojas ativas

Distribuição do número de lojas ativas:

```sql
-- q4a
SELECT
  blob7 AS active_stores,
  sum(double1 / double2 * _sample_interval) AS batches
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 'active_stores'
GROUP BY active_stores
ORDER BY batches DESC
FORMAT JSON
```

Percentagem de instalações com cada loja ativa. A linha com `metric = batch` é o total de lotes, e a percentagem de cada loja é `n` a dividir por esse total:

```sql
-- q4b
SELECT
  blob1 AS metric,
  blob5 AS store,
  sum(double1 / double2 * _sample_interval) AS n
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND (blob1 = 'store_active' OR blob1 = 'batch')
GROUP BY metric, store
ORDER BY n DESC
FORMAT JSON
```

### 5. Afiliados

Ter o apoio ativo e clicar numa ligação são coisas diferentes, por isso ficam em consultas separadas. Um clique também não é uma comissão.

```sql
-- q5a
SELECT
  sumIf(double1 / double2 * _sample_interval, blob6 = 'enabled') / sum(double1 / double2 * _sample_interval) AS affiliate_enabled_share
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 'affiliate_setting'
FORMAT JSON
```

```sql
-- q5b
SELECT
  blob1 AS metric,
  blob4 AS surface,
  sum(double1 / double2 * _sample_interval) AS clicks
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND (blob1 = 'affiliate_click' OR blob1 = 'wook_click_no_affiliate')
GROUP BY metric, surface
ORDER BY metric, clicks DESC
FORMAT JSON
```

### 6. Uso do menu, avisos e abandono

```sql
-- q6a
SELECT
  blob1 AS metric,
  sum(double1 / double2 * _sample_interval) AS n
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND (blob1 = 'popup_open' OR blob1 = 'compare_run' OR blob1 = 'banner_shown' OR blob1 = 'banner_closed')
GROUP BY metric
ORDER BY metric
FORMAT JSON
```

```sql
-- q6b
SELECT
  sumIf(double1 / double2 * _sample_interval, blob6 = 'abandoned') / sum(double1 / double2 * _sample_interval) AS abandoned_rate
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '7' DAY
  AND blob1 = 't_all_settled'
FORMAT JSON
```

### 7. Lotes por dia e por versão

```sql
-- q7
SELECT
  toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day,
  blob3 AS version,
  sum(double1 / double2 * _sample_interval) AS batches
FROM livros_metrics
WHERE timestamp >= NOW() - INTERVAL '30' DAY
  AND blob1 = 'batch'
GROUP BY day, version
ORDER BY day, version
FORMAT JSON
```

## Validar as consultas

`npm run test:metrics-sql` passa dados sintéticos pelo Worker e corre cada consulta deste documento em ClickHouse, num contentor Docker, comparando os resultados com os valores esperados. Precisa de Docker. A CI corre esta validação quando o Worker, o esquema ou este documento mudam.

O Analytics Engine usa um subconjunto do SQL do ClickHouse e não pode ser executado localmente. As consultas usam só funções da sua documentação, e `tests/unit/metrics-queries.test.js` falha se aparecer outra. Mesmo assim, confirma-as com dados reais na primeira utilização.

## Passos manuais

Nada disto corre na CI, e nenhum token entra no Git.

1. Confirmar os custos do Workers, do Analytics Engine e do limite de pedidos antes de ativar.
2. O domínio já associado ao Worker é `metrics-livros.steamhardwarestock.com`. Mantém a rota ou o domínio personalizado existente. Um deploy não cria nem apaga domínios, conjuntos de dados ou limites.
3. Configurar a variável de repositório `CLOUDFLARE_ACCOUNT_ID` e o secret `CLOUDFLARE_METRICS_DEPLOY_TOKEN`. O token de deploy tem apenas as permissões Cloudflare necessárias para editar este Worker e escrever no Analytics Engine associado. Não usar este token para consultas nem o guardar no repositório.
4. Publicar através do workflow **Publicar Worker de métricas**, que corre quando uma release GitHub é publicada. O workflow faz checkout do respetivo tag, testa o Worker, publica com a versão local de Wrangler e confirma `OPTIONS https://metrics-livros.steamhardwarestock.com/v1/batch` antes de mostrar a versão e o endpoint no resumo do job.
5. Para recuperar um deploy falhado, usar `workflow_dispatch` com o mesmo tag da release. É idempotente: volta a publicar o mesmo Worker sem recriar recursos. Confirma o resumo do job e só depois investiga a configuração do domínio ou do token.
6. Para rodar o token, criar um substituto com o mesmo âmbito mínimo, atualizar `CLOUDFLARE_METRICS_DEPLOY_TOKEN`, executar manualmente o workflow para um tag conhecido e revogar o token anterior apenas depois da verificação HTTP passar.
7. Criar um token só com a permissão de leitura `Account Analytics` para as consultas, e guardá-lo fora do repositório.
8. Consultar:

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data-binary @consulta.sql
```

## Texto para a política de privacidade

A secção correspondente está em `PRIVACY.md`. Resumo do destino:

> As estatísticas são enviadas para um serviço próprio alojado na Cloudflare (Workers e Workers Analytics Engine). O endereço IP não é guardado: serve apenas para limitar o número de pedidos, em memória, e não fica em registos. Também não são guardados o navegador completo (User-Agent) nem o país. Os dados agregados são apagados ao fim de três meses.
