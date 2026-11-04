# Preços-alvo e histórico observado

## Preços-alvo da estante

Guarda um livro e introduz um alvo em euros, para o preço do livro. Só são elegíveis ofertas novas em EUR, com stock confirmado, ISBN exato e sem vendedores externos. A primeira correspondência gera uma notificação do sistema e um aviso persistente na extensão. O mesmo preço não volta a notificar; um preço inferior elegível volta a fazê-lo. Editar o alvo reinicia esta comparação.

Um alarme de cinco em cinco minutos escolhe o alvo vencido há mais tempo. Os inícios ficam separados por pelo menos dez minutos e só há um livro em verificação de cada vez. A primeira consulta fica prevista para um a cinco minutos depois; após conclusão, a próxima fica para daí a 24 horas, com até 15 minutos de atraso aleatório. Suspender ou fechar o navegador adia consultas, sem criar uma rajada ao retomar. Não existe servidor a consultar preços com o navegador fechado.

O processo de segundo plano guarda um identificador de tarefa e a revisão do alvo antes de pedir trabalho ao documento de análise. Este confirma imediatamente a receção e envia depois a conclusão, podendo acordar o processo entretanto suspenso. Resultados de alvos removidos, editados, desativados ou apagados são rejeitados. Uma tarefa sem conclusão pode ser repetida após três minutos, respeitando os dez minutos entre inícios. Alterar os avisos de página pode fechar o documento; o estado persistente permite recuperar uma tarefa interrompida.

As alterações à estante e ao histórico passam por uma fila serializada. Comparações manuais acrescentam observações ao estado mais recente, sem substituir resultados agendados por uma cópia antiga do menu. Apagar dados invalida tarefas pendentes e desativa consultas agendadas. Clicar numa notificação abre a extensão, não uma ligação de afiliado. Se o sistema bloquear notificações, o aviso na extensão mantém-se.

## Apenas observações próprias

Os gráficos usam preços do livro observados por esta instalação em comparações manuais e agendadas. Não consultam históricos externos, não reutilizam dados da monitorização em CI, não inferem preços anteriores à instalação. As séries separam loja, moeda e condição. Os pontos são observações; as linhas apenas os ligam, sem afirmar preços entre consultas.

Cada observação regista fonte, instante, preço, moeda, condição e disponibilidade. Os limites são 100 livros guardados, 200 históricos por ISBN, 360 observações por ISBN e uma janela de 90 dias, aplicada quando esse ISBN é atualizado. Há uma lista textual acessível das observações recentes. Uma única observação aparece como ponto, não como uma tendência inventada.

## Atualização de preferências antigas

Os alvos antigos baseados no total passam a usar o preço do livro, mantendo o valor definido. A atualização elimina regras e destino antigos e reinicia a deduplicação desses avisos. A estante e as observações históricas mantêm-se.
