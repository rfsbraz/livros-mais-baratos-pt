# Metadados e automação das lojas

A organização segue a extensão Geocaching: publicação de versões, sincronização de páginas, verificação de credenciais e deteção semanal de divergências. O repositório permanece privado. Estes comandos não criam contas, páginas públicas ou alojamento.

## Fontes e pacote gerado

- `listing.json`: configuração partilhada, identificadores/URLs das lojas e URLs públicos do site.
- `locales/pt-PT.json`: resumo, descrição, termos de pesquisa e ordem das capturas, em português de Portugal.
- `screenshots/`: cinco capturas de 1280x800, com componentes reais e preços identificados como ilustrativos.
- `icons/`: tamanhos entre 16 e 1024 px e SVG editável; usar 128 px em Chrome/Firefox e 300 px em Edge.
- `promo/`: imagens Chrome de 440x280 e 1400x560.
- `templates/`: fontes em português dos textos gerados de revisão, privacidade e instruções.
- `metadata/` e `website/`: textos gerados e páginas de privacidade/apoio prontas a alojar.
- `CHROME_UPDATE.md` e `EDGE_UPDATE.md`: texto gerado para os painéis das lojas.

```sh
npm ci
npx playwright install chromium
npm run store-listing:assets
npm run store-listing:check
```

O pacote completo fica em `dist/livros-mais-baratos-pt-VERSION-store-assets.zip`, com uma pasta por loja, texto em português, capturas ordenadas, ícones, divulgações, notas e valores SHA-256. Os ZIPs de instalação são separados. `npm run store-listing:pack` regenera o pacote sem novas capturas. A CI valida limites de texto e dimensões; as versões GitHub anexam os materiais aos três ZIPs de navegador.

## O que é automático

| Processo              | Comportamento                                                                                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publicação de versões | Release Please cria PRs de versão; uma versão concluída gera o código etiquetado e envia para as lojas ativas. A execução manual escolhe etiqueta e destinos.                                       |
| Página Firefox        | Uma alteração às fontes no ramo principal sincroniza o texto quando a publicação Firefox está ativa. Uma execução manual apenas mostra a previsão, salvo se selecionar a aplicação.                 |
| Versão Firefox        | Verifica se a versão já existe, só envia o pacote se faltar e atualiza notas e capturas. Reutiliza imagens com os mesmos píxeis; envia novas antes de remover antigas. Respeita limites de pedidos. |
| Versão Edge           | Envia o pacote com instruções de revisão e as alterações dessa versão.                                                                                                                              |
| Divergências          | Consulta semanalmente as páginas públicas e compara o português. Atualiza uma issue por loja e fecha-a quando corresponde. Páginas ilegíveis são erros, não prova de divergência.                   |
| Credenciais           | Verifica semanalmente lojas ativas, incluindo validade da chave Edge. Reutiliza e resolve issues existentes.                                                                                        |

Chrome e Edge continuam a exigir os painéis para texto e imagens, como na extensão de referência. As APIs documentadas atualizam os pacotes. Firefox suporta texto e capturas pela AMO. Registo inicial, verificação da conta e primeira página exigem os respetivos painéis.

## Configuração inicial

Não estavam configuradas variáveis ou credenciais de publicação quando este trabalho foi preparado. Não copies credenciais para ficheiros, issues ou conversas. Adiciona-as nas definições de GitHub Actions:

| Destino | Variáveis do repositório                                                    | Segredos do repositório                                            |
| ------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Versões | Nenhuma                                                                     | `RELEASE_PLEASE_TOKEN`                                             |
| Chrome  | `CHROME_PUBLISH_ENABLED=true`, `CHROME_EXTENSION_ID`, `CHROME_PUBLISHER_ID` | `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN` |
| Firefox | `FIREFOX_PUBLISH_ENABLED=true`                                              | `AMO_JWT_ISSUER`, `AMO_JWT_SECRET`                                 |
| Edge    | `EDGE_PUBLISH_ENABLED=true`, `EDGE_API_KEY_EXPIRES` (data ISO)              | `EDGE_PRODUCT_ID`, `EDGE_CLIENT_ID`, `EDGE_API_KEY`                |

Usa segredos do repositório: a verificação semanal não seleciona um ambiente. A publicação mantém `chrome-store`, `firefox-store` e `edge-store` para regras opcionais de proteção. Mantém cada loja desativada até ter uma submissão inicial e credenciais prontas. O GUID Firefox é `livros-mais-baratos-pt@rfsbraz.github.io`.

Preenche os URLs públicos e os identificadores públicos Chrome/Edge em `listing.json` para ativar a deteção de divergências. O identificador público Edge não é o identificador do produto no Partner Center. Acrescenta URLs HTTPS públicos de privacidade, apoio e página inicial e regenera o pacote. Um repositório privado não é uma página pública de privacidade. Email de apoio: `rfsbraz@proton.me`.

Podes prever alterações com `npm run store-listing:amo` e `npm run store-listing:edge-notes`, sem pedidos de rede. `npm run store-listing:release` faz pedidos AMO apenas de leitura. Gerar materiais ou abrir um PR não publica a extensão.

## Idioma e versões

Documentação, páginas das lojas, instruções de revisão e PRs usam português de Portugal. As mensagens de commit podem continuar em inglês. Antes de integrar um PR de versão, revê e traduz as entradas que Release Please extrair desses commits; os títulos das secções são configurados em português. Os códigos de idioma e identificadores técnicos não são traduzidos.

## Referências oficiais

- [API Chrome Web Store](https://developer.chrome.com/docs/webstore/api/reference/rest)
- [API Microsoft Edge Add-ons](https://learn.microsoft.com/en-us/microsoft-edge/extensions/update/api/addons-api-reference)
- [API AMO de páginas e capturas](https://mozilla.github.io/addons-server/topics/api/addons.html)

Mantém-se o versionamento Node e a CI exclusiva de navegador, conforme as convenções do projeto. Atualizações de versões das ações têm PRs de dependências separados.
