# Preparação para código aberto

Preparado em 4 de novembro de 2026. Este trabalho prepara a extensão para um repositório público com licença MIT. Não altera a visibilidade, não integra PRs, não publica nas lojas de extensões e não aloja um site.

## Decisão sobre o histórico

**A auditoria não identificou motivos para reescrever o histórico.** Foram obtidos ramos, etiquetas e referências disponíveis de PRs, incluindo encerrados. No início, existiam 34 commits alcançáveis e 384 conteúdos de ficheiros únicos, com cerca de 2,61 MB. O maior era uma captura de demonstração com 93 KB. O inventário não continha arquivos de submissão, perfis de navegador, ficheiros de credenciais ou capturas completas de páginas privadas.

Gitleaks 8.30.1, obtido da distribuição oficial e verificado pelo respetivo valor de integridade, analisou o histórico com ocultação de segredos nos resultados e não encontrou segredos. Indicou 33 commits analisados; Git conta 34 alcançáveis, incluindo o commit de integração. Uma verificação adicional dos textos históricos não encontrou caminhos locais de pastas de utilizador nem padrões de chaves privadas ou tokens. Mantiveram-se a autoria normal dos commits e o identificador de afiliado Wook divulgado intencionalmente.

A auditoria cobre o conteúdo que pode ser obtido do repositório. Não verifica objetos inacessíveis do servidor, perfis pessoais, valores dos segredos GitHub ou contas privadas. Não prova ausência absoluta de dados sensíveis. Reescrever um histórico sem exposição identificada invalidaria referências e complicaria PRs. Se surgir uma credencial real, deve ser revogada primeiro e depois removida das referências relevantes, incluindo tratamento de referências em cache quando necessário.

## Correções

| Problema                                                             | Correção                                                                                                                                                               |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| minimatch 10.2.6 vulnerável nas ferramentas de estilo                | Substituição por 11.0.1 e atualização das versões fixadas. A auditoria inicial assinalava cinco nós afetados por um único aviso; após correção, zero vulnerabilidades. |
| Comunicação de segurança dependente de uma issue privada             | Contacto privado por email e ligação no formulário de issues.                                                                                                          |
| Instruções antigas de publicação e testes apenas Chrome              | Guia para contribuições, preparação sem credenciais e testes nos três navegadores.                                                                                     |
| Falta de verificações recorrentes de segredos/dependências           | Análises em PRs, alterações ao ramo principal e semanalmente, incluindo ferramentas de desenvolvimento.                                                                |
| Verificações obrigatórias podiam ficar ignoradas após falha anterior | As tarefas unit/browser falham explicitamente quando a tarefa de que dependem falha.                                                                                   |
| Convenções incompletas para colaboração pública                      | Responsável pelo código, configurações do editor, exclusões de dados sensíveis, metadados e avisos sobre terceiros.                                                    |

A substituição de minimatch é temporária porque os pacotes originais ainda pedem 10.x. Só deve ser removida quando resolverem uma versão corrigida e as verificações passarem. Aviso: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Âmbito de segurança e licenciamento

Foram revistos análise/apresentação de páginas remotas, pedidos sem credenciais, validação do remetente das mensagens, origens permitidas, limites de pedidos, lista de ficheiros dos pacotes e permissões das tarefas GitHub. Os testes de PR não recebem credenciais de publicação. A tarefa privilegiada de comentários não obtém nem executa código do PR. Amostras e ferramentas ficam fora dos ZIPs.

A licença MIT não mudou. Não existem dependências npm em execução na extensão. As ferramentas declaram licenças permissivas, registadas nos [avisos sobre terceiros](../THIRD_PARTY_NOTICES.md). Imagens originais e dados sintéticos são distinguidos de conteúdos das lojas.

Estas verificações reduzem riscos, mas não são um teste de intrusão, parecer jurídico ou garantia de segurança. Os adaptadores continuam experimentais e precisam de manutenção.

## Configuração ao tornar público

O repositório permanece privado. GitHub respondeu HTTP 403 ao consultar a proteção do ramo principal, indicando que o plano atual não suporta essa função para este repositório privado. A comunicação privada de vulnerabilidades também não estava disponível. Os alertas de vulnerabilidades nas dependências estão ativos.

Depois de o proprietário decidir tornar o repositório público e de as novas verificações correrem no ramo principal:

```sh
npm run repo:configure
npm run repo:configure -- --apply
```

O primeiro comando mostra uma previsão sem acesso à rede. O segundo exige um administrador autenticado e repositório público. Aplica a proteção versionada e ativa alertas de vulnerabilidades e comunicação privada. Nunca muda visibilidade, segredos, conteúdo dos ramos ou publicação nas lojas.

A política exige `unit`, `browser`, `secret-scan` e `dependency-audit` atualizados; aplica-se aos administradores; proíbe envios forçados e eliminação; e exige resolução das conversas. Exige PRs, mas permite zero aprovações externas para o responsável individual integrar depois de as verificações passarem. Revê a proteção após mudar nomes de tarefas. Ativa também a deteção de segredos e proteção de envios nas definições públicas, quando disponíveis.

Integra primeiro o PR de automação das lojas e depois este PR de preparação. Identificadores das lojas, credenciais de editor e URLs públicos de apoio/privacidade são requisitos separados da distribuição nas lojas; não são necessários para contribuir e testar localmente. Consulta a [configuração](../store-listing/AUTOMATION.md).

## Validação

Passaram localmente 33 testes unitários, os testes nativos nos três navegadores, estilo, formatação, manifesto, geração dos pacotes, validação das páginas das lojas e geração do pacote de submissão. A auditoria final de dependências indica zero vulnerabilidades. Segue os comandos de [CONTRIBUTING.md](../CONTRIBUTING.md) e `npm run store-listing:pack`. A validação usa as dependências corrigidas, não apenas declarações editadas. A CI repete os testes e análises nas alterações seguintes. Os relatórios de auditoria não contêm valores secretos e ficam fora do código-fonte.
