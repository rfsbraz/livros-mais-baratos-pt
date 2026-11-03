# Livros Mais Baratos PT

Extensão Chrome para comparar preços de livros em livrarias portuguesas, pela mesma edição (ISBN), e guardar o histórico das tuas consultas.

## Instalar no Chrome

1. Descarrega e extrai o ZIP da extensão, ou clona este repositório.
2. Abre `chrome://extensions` e ativa o **Modo de programador**.
3. Clica em **Carregar expandida** e escolhe a pasta com `manifest.json` (a pasta `extension/` no repositório).
4. Fixa a extensão na barra de ferramentas. Abre uma página de livro e clica no ícone.
5. Confirma o ISBN e clica em **Comparar**. Autoriza o acesso às quatro livrarias quando o Chrome pedir.

Não precisas de Node.js para instalar a extensão. Ainda não está publicada na Chrome Web Store.

## O que faz

- Deteta ISBN-10/ISBN-13 em dados estruturados e campos da página, validando o dígito de controlo.
- Consulta Wook, Bertrand, Almedina e Bookcover, apresentando apenas preços em euros associados ao ISBN pedido.
- Distingue preços com stock confirmado, sem stock e disponibilidade desconhecida.
- Guarda até 100 livros e o histórico local de consultas (até 90 dias, 200 edições e 360 observações por edição).
- Permite apagar todos os dados locais.

## Limitações desta primeira versão

Os adaptadores são experimentais. As lojas podem bloquear pedidos, alterar o HTML ou servir preços apenas após executar JavaScript. Os testes automáticos usam páginas sintéticas e um perfil Chromium com a extensão real. Em 3 de novembro de 2026, uma consulta real pela extensão confirmou o preço de um livro na Bookcover; as outras três lojas bloquearam os pedidos nesse ambiente. Os percursos de pesquisa e os dados de produto das quatro lojas foram também inspecionados num navegador. A cobertura real deve ser confirmada no teu Chrome. Uma loja sem preço verificável apresenta uma ligação para consulta manual, nunca um preço inventado.

Os preços excluem portes. Saldo em cartão não é tratado como desconto. A extensão não calcula custos finais, não contorna captchas, não usa contas das lojas e não executa scripts recebidos das lojas. Segue os redirecionamentos normais da pesquisa, mas rejeita respostas cujo destino final esteja fora da loja. São examinados no máximo três candidatos por loja.

O histórico começa nas tuas consultas. Não há recolha contínua, notificações, campanhas automáticas, previsão legal de descontos, importação de listas ou servidor nesta versão. Mantém a janela aberta durante a consulta. Fechar o popup interrompe o trabalho em curso.

## Privacidade e permissões

`activeTab` e `scripting` permitem ler a página atual quando abres a extensão. `storage` guarda a estante e o histórico apenas neste navegador. O acesso às quatro lojas é opcional e pedido ao comparar. Cada loja recebe o ISBN pesquisado e os dados de rede normais (incluindo o endereço IP). Os pedidos não enviam cookies de sessão. Sem telemetria, publicidade, afiliados ou serviços externos. Consulta [PRIVACY.md](PRIVACY.md).

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
