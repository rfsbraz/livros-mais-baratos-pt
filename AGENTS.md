# Convenções do projeto

Extensão Manifest V3 em JavaScript, executada apenas no navegador. Mantém o repositório privado até o proprietário pedir expressamente a publicação. A licença MIT não altera a visibilidade.

- Escreve documentação, README, issues, PRs e textos de colaboração em português de Portugal. As mensagens de commit podem ficar em inglês, seguindo Conventional Commits. Preserva identificadores de código, nomes de comandos e campos de APIs.
- Usa Node.js 22+, módulos ES e indentação de dois espaços.
- Respeita as regras de commits e PRs do proprietário. Não uses travessões nem rodapés de atribuição.
- Para alterações funcionais, executa `npm run lint`, `npm run format:check`, `npm run check`, `npm run test:coverage`, `npm run build:all` e `npm run test:e2e`.
- Não há dependências npm em execução, servidor, Python ou contentores. A CI usa Node, navegadores e artefactos ZIP; não se aplicam instruções de publicação de imagens Docker.
- Trata os dados das lojas como não fiáveis. Não uses innerHTML, eval, código remoto, permissões de acesso irrestritas ou formas de contornar captchas.
- Exige o ISBN e a moeda corretos. Não transformes saldo em cartão num desconto imediato.
- Separa testes reais às lojas da CI determinística e documenta as falhas observadas.
- Nunca incluas perfis de navegador de teste, páginas completas extraídas, credenciais ou dados pessoais no Git.
- Os módulos da extensão ficam na raiz e os testes em tests/unit e tests/e2e. Segue a estrutura da extensão de referência. Release Please usa versionamento Node com sincronização do manifesto.
