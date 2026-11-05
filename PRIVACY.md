# Privacidade

Os avisos automáticos estão ativos por predefinição após a instalação. A extensão identifica páginas de livros nas lojas selecionadas e autorizadas sem exigir a abertura do menu. Uma preferência guardada para os desativar é respeitada nas atualizações. A comparação manual também lê a página atual quando abres a extensão.

O HTML é processado localmente para encontrar ISBN, título e preço; não é enviado para um servidor. Ao comparar, o ISBN e, quando necessário, o título são enviados diretamente às lojas selecionadas. Estas recebem os dados normais de ligação, incluindo o endereço IP, e aplicam as próprias políticas de privacidade. Os pedidos não enviam cookies de sessão. As 26 origens configuradas são declaradas como permissões obrigatórias na instalação, mas só as lojas selecionadas são consultadas. Abrir uma ligação manual usa as definições normais de privacidade do navegador.

## Dados locais e conservação

Títulos guardados, ISBN e preços observados ficam em `chrome.storage.local`, não na sincronização do Chrome. Os limites são 100 livros guardados, 200 históricos por ISBN e 360 observações por ISBN. Quando o histórico de um livro é atualizado, as observações desse livro com mais de 90 dias são removidas. Históricos não atualizados podem permanecer até serem substituídos pelo limite de 200 livros ou apagados.

As comparações automáticas reutilizam resultados na memória do documento oculto, até 50 combinações de ISBN/lojas e durante dez minutos. Estes resultados não entram no histórico. Desativar avisos ou alterar as lojas autorizadas fecha esse documento, cancela pedidos e apaga a cache em memória.

Os preços confirmados automáticos, agendados e manuais também ficam em cache local para o menu, até 50 ISBN. O menu oculta entradas com mais de 24 horas e assinala as que têm mais de dez minutos. As entradas expiradas são removidas na próxima escrita; apagar dados elimina toda esta cache. Abrir resultados em cache não contacta lojas nem cria histórico. Fechar um aviso só o suprime no documento atual.

Não existe recolha do histórico geral de navegação nem sistema de contas. Nesta versão a extensão não envia análise de utilização. Não há código remoto. Livros com preços-alvo ativos são verificados aproximadamente todos os dias enquanto o navegador estiver aberto. Só observações manuais e agendadas entram no histórico; não são importados históricos externos ou anteriores à instalação.

## Controlo

As lojas selecionadas e a preferência de avisos ficam guardadas localmente. **Desativar avisos automáticos** interrompe as consultas automáticas e remove avisos das páginas abertas. **Apagar dados** remove estante e histórico, repõe as seis lojas predefinidas e desativa os avisos. Desinstalar remove o armazenamento da extensão. Podes restringir o acesso a sites nas definições do navegador. Uma atualização que acrescente permissões pode exigir nova autorização.

## Ligações de afiliado opcionais

O apoio por afiliados está ativo por predefinição, com a preferência local `affiliateEnabled`. Desativa **Apoiar através de ligações de afiliado** para deixar de o usar. A escolha mantém-se nas atualizações e ao apagar a estante/histórico.

Só um clique deliberado numa oferta Wook confirmada mais barata ou em «Saber mais» de uma campanha Wook detetada pode acrescentar `a_aid=5d3ee4327c2fd`. Identificadores já existentes são preservados. Pedidos de comparação, URL da página, ligações copiadas e resultados guardados não são reescritos. Não há outros parceiros configurados. A ordenação não depende de comissões.

Após o clique, a Wook recebe o identificador e dados normais da navegação e pode usar cookies segundo a sua política. O responsável pode receber uma comissão. Desativar a opção impede futuras adições, mas não elimina cookies já definidos pela Wook.

## Preços-alvo e gráficos

Os preços-alvo e as preferências são guardados localmente. Não é pedido um destino de entrega.

As consultas são distribuídas no tempo e param quando os alvos são pausados/removidos ou a verificação agendada é desativada. Apagar dados remove observações e avisos de alvos, invalida tarefas pendentes e desativa os dois tipos de avisos; mantém a preferência de afiliados. As condições de vales Wook podem ser consultadas automaticamente, sem cookies, a partir da ligação no livro. Os gráficos só usam preços do livro observados nesta instalação.

Sem uma seleção guardada, só são consultadas Wook, Bertrand, Almedina, Continente, Porto Editora e Presença. Seleções guardadas, incluindo uma seleção vazia, são preservadas. Repor os dados restaura estas seis; as restantes são opcionais.

Firefox usa uma página de segundo plano e uma moldura local de análise em vez de `offscreen`. O manifesto declara consentimento para transmissão de conteúdo de sites e atividade de navegação porque as consultas de ISBN/título seguem diretamente para as lojas. Firefox e Edge aplicam as mesmas regras de conservação e preferências de afiliados.

Contacto: **rfsbraz@gmail.com**.

## Condições de vales Wook

As comparações podem consultar a página de condições ligada à área de compra do livro. A consulta não inclui cookies nem afiliado. As regras reconhecidas ficam junto dos preços locais; só são apresentadas durante dez minutos e dentro do prazo da campanha. O HTML das condições não é guardado. As condições não alteram o preço observado nem os alertas de preço-alvo.

A preferência local `wookPromotionEnabled`, ativa por predefinição, controla a utilização da poupança combinada dos vales Wook nas comparações e avisos. Pode ser desativada em Definições, independentemente dos afiliados. O preço equivalente é calculado localmente; a cache, o histórico e os preços-alvo mantêm os preços reais.

## Avaliação e comunicação de problemas

As ligações do rodapé só abrem após um clique. A avaliação abre a loja do navegador. O formulário de problemas no GitHub recebe apenas o nome do navegador e a versão da extensão; não inclui o livro, a página visitada, a estante ou o histórico. O utilizador decide o conteúdo e confirma a publicação no GitHub.
