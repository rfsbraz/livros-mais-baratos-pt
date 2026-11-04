# Preços-alvo, portes e histórico observado

## Preços-alvo da estante

Guarda um livro e introduz um alvo em euros, para o preço do livro ou para o total entregue. Só são elegíveis ofertas novas em EUR, com stock confirmado, ISBN exato e sem vendedores externos. Um alvo com portes exige custos conhecidos para o destino. A primeira correspondência gera uma notificação do sistema e um aviso persistente na extensão. O mesmo preço não volta a notificar; um preço inferior elegível volta a fazê-lo. Editar o alvo reinicia esta comparação.

Um alarme de cinco em cinco minutos escolhe o alvo vencido há mais tempo. Os inícios ficam separados por pelo menos dez minutos e só há um livro em verificação de cada vez. A primeira consulta fica prevista para um a cinco minutos depois; após conclusão, a próxima fica para daí a 24 horas, com até 15 minutos de atraso aleatório. Suspender ou fechar o navegador adia consultas, sem criar uma rajada ao retomar. Não existe servidor a consultar preços com o navegador fechado.

O processo de segundo plano guarda um identificador de tarefa e a revisão do alvo antes de pedir trabalho ao documento de análise. Este confirma imediatamente a receção e envia depois a conclusão, podendo acordar o processo entretanto suspenso. Resultados de alvos removidos, editados, desativados ou apagados são rejeitados. Uma tarefa sem conclusão pode ser repetida após três minutos, respeitando os dez minutos entre inícios. Alterar os avisos de página pode fechar o documento; o estado persistente permite recuperar uma tarefa interrompida.

As alterações à estante e ao histórico passam por uma fila serializada. Comparações manuais acrescentam observações ao estado mais recente, sem substituir resultados agendados por uma cópia antiga do menu. Apagar dados invalida tarefas pendentes e desativa consultas agendadas. Clicar numa notificação abre a extensão, não uma ligação de afiliado. Se o sistema bloquear notificações, o aviso na extensão mantém-se.

## Modelo de portes

As estimativas são para um livro com entrega normal. Os destinos são Portugal continental (predefinido), Madeira, Açores e outros. Cada loja automática permite introduzir portes, mínimo para entrega gratuita, validade da regra e uma promoção opcional com datas. Portes desconhecidos são `null`, nunca zero. Totais desconhecidos não recebem a indicação de menor preço entregue nem acionam alvos com portes.

A comparação manual ordena por total entregue, com opção de ordenar apenas pelo livro. Na página, compara totais quando ambas as regras são conhecidas; caso contrário, identifica explicitamente a comparação sem portes. Não infere portes de vendedores externos, taxas de importação, encomendas pesadas ou serviços pagos.

Regras iniciais verificadas em 3 de novembro de 2026, com validade de 30 dias:

- Wook: entrega normal gratuita no continente a partir de 16 €. O custo abaixo desse valor é desconhecido. Não desconta reembolso em cartão. Entrega normal para Madeira/Açores gratuita nas condições publicadas, até 10 kg e excluindo vendedores externos. [Fonte](https://www.wook.pt/Mensagem/index/?key=portes-gratis)
- Presença: no continente, 3 € abaixo de 20 € e gratuito acima de 20 €. Exatamente 20 € fica desconhecido devido à ambiguidade do texto publicado. Madeira/Açores: 4 €. [Fonte](https://www.presenca.pt/policies/shipping-policy)

As restantes lojas começam com portes desconhecidos. São estimativas editáveis, não garantias de pagamento final. As regras publicadas guardam fonte, datas, condições e validade; as alterações do utilizador são marcadas como manuais. Uma regra expirada fica desconhecida até revisão, salvo se existir uma promoção válida independente.

Uma promoção exige informação confirmada, destino explícito, valor mínimo e datas de início e fim. Aplica-se desde o início e deixa de se aplicar no instante de fim. A interface aceita campanhas confirmadas pelo utilizador. Futuros detetores podem preencher este modelo depois de validar destino, âmbito, condições e provas. A deteção automática ainda não existe.

## Apenas observações próprias

Os gráficos usam preços do livro observados por esta instalação em comparações manuais e agendadas. Não consultam históricos externos, não reutilizam dados da monitorização em CI, não inferem preços anteriores à instalação e não recalculam portes históricos com regras atuais. As séries separam loja, moeda e condição. Os pontos são observações; as linhas apenas os ligam, sem afirmar preços entre consultas.

Cada observação regista fonte, instante, preço, moeda, condição e disponibilidade. Os limites são 100 livros guardados, 200 históricos por ISBN, 360 observações por ISBN e uma janela de 90 dias, aplicada quando esse ISBN é atualizado. Há uma lista textual acessível das observações recentes. Uma única observação aparece como ponto, não como uma tendência inventada.
