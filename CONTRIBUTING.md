# Contribuir

Obrigado por ajudares a melhorar a comparação de preços de livros em Portugal. São bem-vindas melhorias de documentação e acessibilidade, relatos de erros e adaptadores de lojas bem testados. Consulta o [código de conduta](CODE_OF_CONDUCT.md) e comunica vulnerabilidades em privado, conforme a [política de segurança](SECURITY.md).

## Preparar o ambiente

Usa Node.js 22.13 ou posterior na linha 22.x, Git e um navegador suportado. Se não fizeres parte da equipa responsável, cria uma cópia do repositório no GitHub (fork) e obtém o código dessa cópia:

```sh
git clone https://github.com/O-TEU-UTILIZADOR/livros-mais-baratos-pt.git
cd livros-mais-baratos-pt
npm ci
npx playwright install chromium firefox msedge
npm run build:all
```

Em Linux, pode ser necessário usar `npx playwright install --with-deps chromium firefox msedge`. A instalação do Edge pode pedir acesso de administrador. Não precisas de credenciais das lojas, conta de editor, Docker ou servidor para desenvolver e testar. Os navegadores de teste não entram nos ZIPs distribuídos.

Carrega `dist/chrome` em `chrome://extensions` ou `dist/edge` em `edge://extensions`, com o modo de programador ativo. Em Firefox, abre `about:debugging#/runtime/this-firefox`, escolhe carregar um extra temporário e seleciona `dist/firefox/manifest.json`. Volta a gerar e a carregar a extensão após alterar o código.

## Verificações

```sh
npm run lint
npm run format:check
npm run check
npm run test:coverage
npm run build:all
npm run test:e2e
npm run store-listing:check
npm run audit:dependencies
```

`npm run format` aplica a formatação. Os comandos `npm run test:e2e:chromium`, `test:e2e:firefox` e `test:e2e:edge` permitem testar um navegador durante o desenvolvimento. A CI testa os três. Os testes usam respostas sintéticas e perfis temporários isolados, nunca a tua sessão pessoal.

Com Make instalado, `make build` gera os três pacotes, `make run` mostra as instruções de carregamento, `make unit` executa testes unitários, `make integration` gera os pacotes e testa os três navegadores, e `make test` executa ambos os grupos. Em Windows podes usar diretamente os comandos npm.

Para uma análise local opcional do histórico, instala Gitleaks e executa `gitleaks git . --log-opts="--all --full-history" --redact`. A CI fixa a versão e verifica a integridade da ferramenta. Nunca copies segredos para issues ou registos.

## Código e adaptadores de lojas

Usa indentação de dois espaços e módulos ES. Separa a análise de dados do acesso à rede, usa `textContent` para conteúdo não fiável e valida ISBN, moeda e origem de destino. Distingue disponibilidade desconhecida, livros usados, vendedores externos e saldo em cartão. Não contornes captchas, autenticação ou restrições de acesso.

Para adicionar uma loja:

1. Inspeciona páginas públicas de pesquisa e produto. Confirma que o identificador corresponde à edição, não a um SKU interno.
2. Atualiza `stores.js`, os domínios explícitos do manifesto, a documentação de cobertura e uma amostra de teste pequena, sintética ou expurgada de dados privados. Não incluas páginas completas, capas, cookies de sessão, dados de clientes ou HTML autenticado.
3. Testa casos positivos e negativos: edição correta, ISBN diferente, preço ausente, falta de stock e bloqueios, quando aplicável.
4. Usa `node scripts/live-smoke.mjs STORE_ID` apenas quando for necessária uma consulta real. Regista data, URL público, ISBN e resultado. Perfis e resultados temporários ficam em `work/`, excluído do Git.

Os testes habituais não devem depender dos sites das lojas. Mantém a monitorização real separada e respeita os intervalos entre pedidos e as limitações de frequência.

## Pull requests

Cria um ramo, mantém a alteração focada, executa as verificações relevantes e explica o problema e o comportamento resultante em pontos de resumo. Inclui os resultados da validação e atualiza a documentação. Não é exigido um CLA; as contribuições são submetidas sob a licença MIT do repositório. Contribui apenas com material que tens autorização para partilhar.

Documentação, títulos e descrições de PRs, issues e respostas de colaboração devem usar português de Portugal. Os commits podem continuar em inglês, com um título Conventional Commits, por exemplo `fix(parser): reject a different ISBN`. Mantém os prefixos técnicos dos títulos de PR, mas escreve o restante texto em português, por exemplo `fix(parser): rejeitar um ISBN diferente`. Não acrescentes rodapés de atribuição.

Segue o modelo de PR e responde de forma construtiva à revisão. Um responsável analisa e integra as alterações; não é prometido um prazo fixo de aprovação.

## Dependências e imagens

A extensão não distribui dependências npm em execução. As ferramentas estão fixadas em `package-lock.json`; inclui alterações ao manifesto e ao ficheiro de versões no mesmo commit. A substituição temporária de minimatch por 11.0.1 corrige GHSA-g3hv-75wg-m249. Só a retires quando as dependências originais resolverem uma versão corrigida e as verificações continuarem a passar.

Ícones e composições originais usam a licença do projeto. As capturas identificam os preços de demonstração. Consulta os [avisos sobre terceiros](THIRD_PARTY_NOTICES.md). Regenera os materiais com `npm run store-listing:assets`; altera também as fontes dos textos gerados para que as traduções persistam.

## Publicações pelo responsável

Release Please usa o versionamento Node já adotado pelo projeto e sincroniza as versões do pacote e manifesto. A publicação é ativada por navegador e exige credenciais próprias desta extensão. Consulta a [automação das lojas](store-listing/AUTOMATION.md). Nas versões derivadas, mantém a publicação e a monitorização real desativadas até as configurar, usa identidades próprias nas lojas e revê o identificador de afiliado em `affiliate.js`.

O [relatório de preparação para código aberto](docs/oss-readiness.md) regista a auditoria e as configurações pendentes. `npm run repo:configure` mostra uma previsão sem alterações; `-- --apply` é uma operação separada para um administrador autenticado, após tornar o repositório público. Nunca altera a visibilidade.
