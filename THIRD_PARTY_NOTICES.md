# Avisos sobre terceiros e conteúdos

## Código e imagens do projeto

O código, os ícones originais e as composições promocionais são distribuídos sob a [licença MIT](LICENSE). As ferramentas de publicação foram adaptadas de [Geocaching.com Friends Logs](https://github.com/rfsbraz/Geocaching.com-Friends-Logs), outro projeto MIT do mesmo responsável.

As capturas usam componentes reais da extensão, respostas sintéticas e preços identificados como ilustrativos. O bloco de capa de demonstração é uma composição de texto original, não uma reprodução da capa publicada. O repositório não inclui logótipos de lojas, textos integrais de livros ou páginas autenticadas completas.

Nomes de lojas, títulos de livros, ISBN e endereços públicos identificam fontes suportadas e exemplos. Não implicam recomendação ou aprovação pelos titulares. Conteúdos e marcas de terceiros continuam sujeitos aos respetivos direitos; a licença MIT deste projeto não concede direitos sobre conteúdos obtidos durante a utilização da extensão.

## Ferramentas de desenvolvimento

A extensão não distribui dependências npm em execução. Os pacotes são gerados a partir de uma lista explícita de ficheiros que exclui ferramentas de teste, navegadores descarregados, node_modules e credenciais.

As dependências de desenvolvimento fixadas no ficheiro de versões declaram os identificadores MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, BlueOak-1.0.0 e 0BSD. Estes metadados não substituem os textos das licenças. `package-lock.json` identifica as versões e os valores de integridade; cada pacote instalado mantém os seus próprios avisos e licenças.

As ferramentas diretas incluem ESLint, Playwright, playwright-webextext, esbuild, Prettier, globals e tslib. Gitleaks é descarregado apenas para a CI e para auditorias ao histórico. Os navegadores usados nos testes têm licenças próprias e não são redistribuídos nos pacotes da extensão.

Ao adicionar dependências ou código de terceiros, regista a licença, preserva os avisos exigidos e verifica se o conteúdo é distribuído aos utilizadores. A licença de uma ferramenta não cobre automaticamente conteúdos das lojas.

## Afiliados

O identificador público Wook em `affiliate.js` é um identificador de atribuição, não uma credencial. As ligações opcionais estão ativas por predefinição e podem ser desativadas nas definições. Não alteram os pedidos de comparação. Em empate de preço, ao cêntimo, a loja com ligação de afiliado na configuração fica à frente. Quem distribuir uma versão derivada deve rever o identificador e as divulgações correspondentes.
