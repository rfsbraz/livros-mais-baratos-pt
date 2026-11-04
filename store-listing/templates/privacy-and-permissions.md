# Privacidade e permissões nas lojas

Versão {{version}}. Estas declarações descrevem o código empacotado. O titular da conta deve rever as certificações no painel ao submeter.

## Finalidade única

Comparar a mesma edição de um livro em lojas selecionadas, com avisos automáticos de ofertas mais baratas e registo local de observações.

## Justificação das permissões

- `activeTab`: lê o separador atual quando o utilizador abre a extensão, para identificar ISBN e título na comparação manual.
- `scripting`: lê a página ativa e regista o script incluído de deteção apenas em lojas selecionadas/autorizadas. Ativo por predefinição salvo desativação guardada; também inicializa separadores já abertos.
- `storage`: guarda ISBN, títulos, histórico próprio, alvos, estado de notificações, portes, destino, lojas e preferências em chrome.storage.local. Sem sincronização ou análise de utilização.
- `alarms`: agenda consultas espaçadas apenas para alvos ativos e restaura o agendamento após reinício.
- `notifications`: avisa quando um alvo é atingido ou surge preço elegível inferior; o aviso também fica na extensão.
- `offscreen`: em Chrome/Edge, fornece DOM oculto incluído no pacote para analisar HTML enquanto a comparação decorre sem o menu aberto. Firefox usa página/moldura local equivalente. Scripts descarregados não são executados.
- `host_permissions`: consulta páginas de pesquisa/produto por HTTPS e deteta livros nas mesmas origens autorizadas. As 26 origens específicas são declaradas na instalação; os pedidos só usam lojas selecionadas. Não há acesso irrestrito.

## Código remoto

Selecionar a opção que declara não usar código remoto. Todo o JavaScript executável acompanha a extensão. HTML e JSON das lojas são dados. Importações dinâmicas apontam para módulos incluídos, não código de terceiros.

## Divulgação de tipos de dados

O processamento local também deve ser divulgado. A extensão não deve ser descrita como tratando zero dados.

| Tipo no painel                      | Seleção          | Âmbito                                                                                                |
| ----------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------- |
| Conteúdo de sites                   | Sim              | Página do livro, ISBN, título, preço e disponibilidade; HTML permanece local.                         |
| Histórico/atividade de navegação    | Sim              | URL atual de lojas suportadas para deteção e encaminhamento; sem registo geral de navegação.          |
| Atividade do utilizador             | Sim              | Seleção de lojas, ações da estante e preferências locais; sem telemetria de cliques, rato ou teclado. |
| Informação de identificação pessoal | Não, na extensão | Sem recolha de conta, nome ou email; contactos voluntários de apoio são tratados separadamente.       |
| Informação de saúde                 | Não              | Sem recolha para fins de saúde.                                                                       |
| Informação financeira/pagamento     | Não              | Só preços públicos de produtos; sem acesso a pagamentos.                                              |
| Autenticação                        | Não              | Sem palavras-passe ou cookies de autenticação; os pedidos omitem cookies de sessão.                   |
| Comunicações pessoais               | Não, na extensão | Não lê emails ou mensagens; correspondência de apoio é externa.                                       |
| Localização                         | Não              | Sem geolocalização ou perfis; as lojas recebem o IP normal da ligação.                                |

## Utilização de dados

A extensão não vende nem transfere dados para finalidades alheias, não os usa para crédito/empréstimos nem recolhe navegação para perfis publicitários. Cliques de afiliado divulgados enviam o identificador à Wook, que pode usar cookies segundo a sua política. ISBN/título só seguem para lojas selecionadas para a comparação descrita. Nenhum servidor do responsável recebe páginas ou dados de navegação. Revê a política de privacidade antes de confirmar as certificações de utilização limitada.

## URL de privacidade

Pendente: alojar website/privacy.html num URL HTTPS público e introduzi-lo no painel. Uma ligação local ou um repositório privado não são uma política pública.

## Origens declaradas na instalação

{{hosts}}

Fontes: [campos de privacidade](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) e [divulgação de dados locais e conteúdo de sites](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).
