# Campanhas Wook com devolução em vale

A deteção parte de uma página de livro com ISBN confirmado e da ligação informativa na sua área de compra. Não procura o nome «100%», uma imagem específica ou um endereço de campanha fixo. Só consulta ligações HTTPS para a página de mensagens da própria Wook, mantendo o identificador encontrado na página.

A página de condições tem de declarar devolução do valor pago em vale, percentagem devolvida, limite percentual de utilização, datas da campanha em Portugal continental, prazo do vale e momento de emissão. As datas usam Europe/Lisbon. Condições incompletas, desconhecidas, expiradas ou inacessíveis não produzem estimativas. Os formatos de datas suportados são um dia, dois dias consecutivos ou um intervalo no mesmo mês. Mudanças substanciais nas condições exigem adaptar e testar o leitor.

## Cálculo

Para um preço P, uma devolução r e um limite de utilização c (frações de 1): o crédito é P × r; as compras futuras mínimas são crédito / c; a poupança combinada é crédito / (P + compras futuras). Os valores monetários são arredondados conservadoramente ao cêntimo.

Exemplo: 18,85 € pagos hoje, 18,85 € de vale e limite de utilização de 50%. Para gastar todo o vale são necessários pelo menos 37,70 € em compras futuras, pagando mais 18,85 €. São 37,70 € pagos por 56,55 € de artigos, cerca de 33,3% de poupança combinada. É uma estimativa condicionada à utilização integral do vale, sujeita às exclusões da loja. Não é um desconto imediato nem garantido para uma compra isolada.

As [condições consultadas em 4 de novembro de 2026](https://www.wook.pt/Mensagem/index/?key=campanha100) indicavam uma campanha nos dias 4 e 5, emissão do vale 15 dias após o envio completo, validade de 60 dias e utilização até 50% de cada encomenda elegível. A extensão lê estes valores da página; não fixa essas datas nem percentagens. Confirma sempre exclusões, limites de encomenda e acumulação na loja.

## Apresentação e pedidos

A opção **Considerar vales Wook na comparação** fica ativa por predefinição em Definições. Aplica a percentagem de poupança combinada ao preço Wook, com arredondamento conservador ao cêntimo, para ordenar ofertas no menu e apresentar avisos automáticos noutras lojas. Por exemplo, Wook a 20 € com devolução de 100% e utilização até 50% corresponde a 13,34 € estimados; pode gerar um aviso numa página Continente a 18 €. O aviso e o menu distinguem este equivalente do valor a pagar agora.

A opção é independente dos afiliados, mantém-se nas atualizações e recalcula os resultados guardados sem alterar os preços em cache. Quando desativada, expirada ou sem condições confirmadas, a comparação usa o preço a pagar. Numa página Wook, aplica-se o mesmo critério ao preço atual quando a consulta confirma esse preço.

Os preços-alvo e o histórico mantêm os valores reais. O aviso informativo da campanha e «Saber mais» continuam disponíveis mesmo com a opção de cálculo desativada.

As condições são consultadas sem cookies, com os limites de tempo, tamanho e origem usados nas comparações. Consultas simultâneas da mesma campanha partilham um pedido. A memória temporária é limitada a 20 campanhas, reutilizadas durante dez minutos. A apresentação expira também no fim da campanha. Recomendações e faixas genéricas fora da área de compra não tornam o livro elegível.

**Saber mais** abre a ligação de condições encontrada no livro. A preferência de afiliados existente aplica-se: enquanto estiver ativa, a ligação inclui o identificador. Não há afiliado nos pedidos de deteção ou nos endereços guardados. Desativar a opção mantém a ligação normal.

## Verificação

Os testes cobrem nomes alternativos, percentagens diferentes, datas de inverno/verão, condições incompletas, endereços externos, campanha expirada, cálculo, preservação do preço e da cache, ligações com e sem afiliado e um aviso automático numa instalação real de Chromium.
