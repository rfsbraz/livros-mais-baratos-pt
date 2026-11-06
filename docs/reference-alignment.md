# Organização e alinhamento da extensão

Referência: [Geocaching.com-Friends-Logs](https://github.com/rfsbraz/Geocaching.com-Friends-Logs), inspecionada na revisão `9f46486230605c580abac1635d0c0297076cb271`.

## Estrutura e comandos

Módulos, manifesto, menu e ícones ficam na raiz. `tests/unit` contém testes de lógica; `tests/e2e`, testes de navegador e o relatório Playwright; `scripts`, ferramentas; e `store-listing`, materiais de publicação.

Executa `npm ci`, `npm run lint`, `npm run format:check`, `npm run test:coverage`, `npm run build:all` e `npm run test:e2e`. Instala os navegadores com `npx playwright install chromium firefox msedge`. Chrome e Edge usam um processo de serviço e um analisador oculto; Firefox usa uma página de segundo plano não persistente e uma moldura local, com as mesmas validações de mensagens. O registo dinâmico respeita as preferências de avisos e lojas. O código é partilhado e Firefox empacota o ponto de entrada de conteúdo com esbuild. Os ZIPs usam uma lista explícita de ficheiros, excluindo testes e ferramentas.

Carrega `dist/chrome` ou `dist/edge` em modo de programador. Em Firefox, usa `about:debugging` e `dist/firefox/manifest.json`. Instalações permanentes Firefox exigem assinatura AMO. A versão mínima Firefox é 140 no computador e 142 em Android; permissões e consentimento continuam sob controlo do navegador.

## Automação

A CI segue as tarefas `lint-and-test` e `e2e-tests` da referência. Os nomes de verificações obrigatórias `unit` e `browser` são preservados. Node 22 é mantido pelos recursos usados nos testes; os testes unitários usam o executor nativo Node, sem migração desnecessária para Jest.

A publicação separa Release Please, escolha da etiqueta, geração dos pacotes e envio para cada navegador. O versionamento Node sincroniza o manifesto. A execução manual permite escolher uma etiqueta existente e o destino. As credenciais só estão disponíveis nas tarefas que precisam delas. A publicação exige variáveis de ativação por loja e pode usar ambientes protegidos. Não são reutilizados identificadores de outra extensão.

Os títulos dos PRs seguem Conventional Commits, com o texto descritivo em português. Dependabot verifica dependências diariamente; apenas correções de versão elegíveis podem ter integração automática, com proteção verificada. A CI corre semanalmente. A monitorização das livrarias mantém os 24 períodos horários e atrasos aleatórios. As verificações semanais de credenciais e divergências separam consulta e atualização de issues e mantêm o agendamento ativo. URLs ausentes e publicação desativada são ignorados; uma página ilegível nunca fecha uma divergência existente.

## Configuração de publicação

Cria as páginas desta extensão nas lojas, define URLs públicos de apoio/privacidade e preenche `store-listing/listing.json`. Configura os ambientes `chrome-store`, `firefox-store` e `edge-store` com as regras de revisão pretendidas.

- Versões: segredo `RELEASE_PLEASE_TOKEN`.
- Chrome: variáveis `CHROME_PUBLISH_ENABLED=true`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID`; segredos `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.
- Edge: variáveis `EDGE_PUBLISH_ENABLED=true`, `EDGE_API_KEY_EXPIRES` (AAAA-MM-DD); segredos `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`.
- Firefox: variável `FIREFOX_PUBLISH_ENABLED=true`; segredos `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`. GUID: `livros-mais-baratos-pt@rfsbraz.github.io`.

Usa segredos do repositório para permitir a verificação semanal, que não seleciona um ambiente de loja. Consulta a [automação das lojas](../store-listing/AUTOMATION.md). O Firefox deteta versões já existentes e atualiza notas e imagens nas repetições. Chrome e Edge usam os painéis para texto/imagens e as APIs para pacotes.

Os testes Firefox verificam comparações automáticas, cache e alvos através de uma ponte temporária de teste, pois Playwright não controla páginas privilegiadas do menu Firefox. Chromium cobre a interação completa do menu e Edge usa o navegador Microsoft Edge. As amostras e pontes ficam fora dos pacotes de produção.
