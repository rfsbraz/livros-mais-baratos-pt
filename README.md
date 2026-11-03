# Livros Mais Baratos PT

Extensão Chrome para comparar preços de livros em livrarias portuguesas, pela mesma edição (ISBN), e guardar o histórico das tuas consultas.

## Instalar no Chrome

1. Descarrega e extrai o ZIP da extensão, ou clona este repositório.
2. Abre `chrome://extensions` e ativa o **Modo de programador**.
3. Clica em **Carregar expandida** e escolhe a pasta com `manifest.json` (a pasta `extension/` no repositório).
4. Aceita as permissões de acesso às lojas que o Chrome apresentar e visita uma página de livro suportada. As comparações começam automaticamente.
5. Para comparar manualmente ou ajustar preferências, abre o ícone da extensão. Confirma o ISBN, escolhe as lojas e clica em **Comparar**. O título é opcional.

Não precisas de Node.js para instalar a extensão. Ainda não está publicada na Chrome Web Store.

## Avisos automáticos ao visitar um livro

Os avisos estão ativos por predefinição após a instalação, com acesso às lojas solicitado pelo Chrome nesse momento. Não precisas de abrir a extensão nem de fazer configuração adicional: ao visitar uma página de livro numa loja selecionada e autorizada, aparece um aviso no canto inferior direito se outra loja tiver a mesma edição nova mais barata, com stock confirmado. O aviso mostra os dois preços, a poupança e a ligação da oferta. Podes fechá-lo ou desativar os avisos na extensão.

Os avisos exigem ISBN e preço atual verificáveis e comparam livros novos em EUR. Não se aplicam a páginas de pesquisa, ofertas usadas, marketplaces ou formatos digitais identificados. Portes não incluídos. Resultados de consultas recentes podem ser reutilizados durante dez minutos; a hora da consulta aparece no aviso. Podes alterar a seleção de lojas ou desligar os avisos. Uma preferência guardada de desativação é preservada nas atualizações. Se o Chrome tiver restringido o acesso a um site, ajusta-o nas definições da extensão. Lojas bloqueadas continuam sem preço confirmado.

## O que faz

- Deteta ISBN-10/ISBN-13 em dados estruturados e campos da página, validando o dígito de controlo.
- Inclui 26 adaptadores automáticos: Wook, Bertrand, Almedina, Bookcover, Continente, Porto Editora, Lyvros, Penguin, Presença, Guerra e Paz, Gradiva, Relógio d'Água, Saída de Emergência, Quetzal, Antígona, Snob, Kingpin, mbooks, Auchan, Blackwell's, Waterstones, IberLibro, AbeBooks, El Corte Inglés, Devir e Mundo Fantasma.
- Permite escolher lojas, consultar até quatro em simultâneo e interromper a comparação.
- Inclui 17 fontes de consulta manual e 17 entradas de referência para outros formatos, aliases, chancelas e endereços indisponíveis. Todas as lojas mencionadas no levantamento estão contabilizadas em [Cobertura das lojas](docs/store-coverage.md).
- Verifica o ISBN do produto mesmo quando encontra candidatos pelo título. Não confunde códigos internos com ISBN.
- Distingue preços com stock confirmado, sem stock e disponibilidade desconhecida.
- Preserva moeda, condição e vendedor. Livros usados e preços GBP/USD não entram no mínimo de livros novos em EUR.
- Guarda até 100 livros e o histórico local de consultas (até 90 dias, 200 edições e 360 observações por edição).
- Permite apagar todos os dados locais.

## Cobertura real e limitações

Os adaptadores são experimentais. Em 3 de novembro de 2026, testes reais na extensão local confirmaram preços em **18 das 26 lojas automáticas**. Os outros oito adaptadores não concluíram os pedidos nesse ambiente, embora as páginas de produto e os percursos tenham sido inspecionados num navegador. Uma amostra bem-sucedida não garante todo o catálogo. As lojas podem bloquear pedidos ou alterar páginas. Uma loja sem preço verificável apresenta uma ligação para consulta manual. Consulta os resultados e as particularidades de cada loja no [relatório de cobertura](docs/store-coverage.md).

Os preços excluem portes e taxas de importação. Saldo em cartão não é tratado como desconto. A extensão não calcula custos finais, não contorna captchas, não usa contas das lojas e não executa scripts recebidos das lojas. Segue redirecionamentos normais, rejeita destinos fora da loja e ignora ligações que alterem o carrinho. Examina até seis candidatos por loja, com prazo total de 35 segundos por loja. Uma oferta de marketplace não é uma garantia do mínimo de todos os vendedores.

Define preços-alvo nos livros guardados, com ou sem portes. As verificações são aproximadamente diárias enquanto o Chrome está aberto e mostram notificações ao atingir o alvo. Os gráficos contêm apenas preços observados nesta instalação, em consultas manuais e agendadas. Não há históricos externos, deteção automática de campanhas, previsão legal de descontos, importação de listas ou servidor. Mantém a janela aberta durante uma comparação manual. Os avisos automáticos, quando ativados, funcionam independentemente da janela da extensão e não acrescentam observações ao histórico.

## Privacidade e permissões

`activeTab` permite a deteção manual. `scripting` também ativa a deteção nas lojas autorizadas por predefinição, respeitando a opção de desligar os avisos. `offscreen` permite processar páginas das lojas sem manter a janela da extensão aberta. `alarms` agenda verificações de alvos e `notifications` mostra os avisos do sistema. `storage` guarda a estante, as preferências e o histórico apenas neste navegador. O acesso aos domínios das 26 lojas é solicitado na instalação. Atualizações que adicionem permissões podem exigir aprovação no Chrome. Cada loja consultada recebe o ISBN e, quando necessário, o título, além dos dados normais de rede (incluindo endereço IP). Os pedidos não enviam cookies de sessão. Sem telemetria. Ligações de afiliado Wook estão ativas por predefinição e podem ser desativadas na extensão. Só acrescentamos o código ao clicar numa oferta confirmada mais barata; não altera preços, ordenação nem pedidos de comparação. Consulta [PRIVACY.md](PRIVACY.md).

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run test:integration
npm run build
```

O ZIP fica em `dist/`. A extensão não tem dependências de execução nem precisa de compilação. O Playwright é usado apenas nos testes. Consulta [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md) e [docs/architecture.md](docs/architecture.md).

O repositório permanece privado, mas segue práticas de colaboração abertas e usa a [licença MIT](LICENSE).

## Portes e preços-alvo

Em Entrega e portes, escolhe o destino e configura custos, mínimos para portes grátis e campanhas com datas. Existem regras iniciais verificadas para Wook e Presença, com validade de 30 dias. Nas restantes lojas, os portes são desconhecidos até introduzires uma regra. Nunca são tratados como grátis. Consulta [o funcionamento e as fontes](docs/targets-shipping-history.md).

## Monitorização das lojas

As 26 lojas automáticas estão distribuídas por 24 horários diários: uma ou duas lojas por hora, com atrasos aleatórios entre pedidos. Os limites HTTP 429 são distinguidos dos bloqueios 403. Falhas atualizam uma issue sem apagar resultados de lojas ainda não verificadas; os avisos fecham após recuperação. Consulta [a documentação](docs/store-monitoring.md).

Confirmed background, scheduled and manual results are cached locally for up to 50 ISBNs. Opening the menu on a detected book restores selected-store prices immediately, with the check time. Results older than ten minutes are marked potentially outdated; results older than 24 hours are hidden and pruned on the next write. Comparar explicitly refreshes prices. Cached displays do not create history observations. Clear data deletes this cache and invalidates pending background writes. Shipping totals are recomputed using current rules.

## ☕ Support

If you find this useful and want to support development, you can [buy me a coffee](https://buymeacoffee.com/rfsbraz) - no pressure at all, just a nice way to say thanks.
