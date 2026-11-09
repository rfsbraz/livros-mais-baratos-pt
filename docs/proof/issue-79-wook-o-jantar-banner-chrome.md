# Prova #79 — aviso em página na Wook (Chrome, sem clique no menu)

- URL: `https://www.wook.pt/livro/o-jantar-freida-mcfadden/33978897`
- Extensão: build `dist/chrome` deste PR, instalação fresca.
- Sem abrir o popup: o content script `book-alerts` corre, compara e mostra `#lmb-price-alert`.
- A cadeia «A procurar o livro nesta página…» está só em `popup.html` (estado inicial do menu); a página não a mostra e não fica presa a detetar.

![Banner no O Jantar](./issue-79-wook-o-jantar-banner-chrome.png)
