# Livros Mais Baratos PT

Extensão Chrome para comparar preços de livros em livrarias portuguesas, pela mesma edição (ISBN), e guardar o histórico das tuas consultas.

## Instalar no Chrome

1. Descarrega e extrai o ZIP da extensão, ou clona este repositório.
2. Abre `chrome://extensions` e ativa o **Modo de programador**.
3. Clica em **Carregar expandida** e escolhe a pasta com `manifest.json` (a pasta `extension/` no repositório).
4. Fixa a extensão na barra de ferramentas. Abre uma página de livro e clica no ícone.
5. Confirma o ISBN, escolhe as lojas e clica em **Comparar**. Autoriza o acesso às lojas selecionadas quando o Chrome pedir. O título é opcional e ajuda nos catálogos que não pesquisam por ISBN.

Não precisas de Node.js para instalar a extensão. Ainda não está publicada na Chrome Web Store.

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

O histórico começa nas tuas consultas. Não há recolha contínua, notificações, campanhas automáticas, previsão legal de descontos, importação de listas ou servidor nesta versão. Mantém a janela aberta durante a consulta. Fechar o popup interrompe o trabalho em curso.

## Privacidade e permissões

`activeTab` e `scripting` permitem ler a página atual quando abres a extensão. `storage` guarda a estante, a seleção e o histórico apenas neste navegador. O acesso às lojas é opcional e pedido apenas para as selecionadas. Cada loja consultada recebe o ISBN e, quando necessário, o título, além dos dados normais de rede (incluindo endereço IP). Os pedidos não enviam cookies de sessão. Sem telemetria, publicidade ou afiliados. Consulta [PRIVACY.md](PRIVACY.md).

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

## ☕ Support

If you find this useful and want to support development, you can [buy me a coffee](https://buymeacoffee.com/rfsbraz) - no pressure at all, just a nice way to say thanks.
