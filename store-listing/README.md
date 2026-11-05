# Pacote de submissão nas lojas de extensões

Livros Mais Baratos PT · 0.1.5 · Gerado a partir do código do repositório.

Consulta [AUTOMATION.md](AUTOMATION.md) para configuração e publicação em Chrome, Firefox e Edge. `npm run store-listing:pack` gera o ZIP com uma pasta por loja.

## Ficheiros a utilizar

| Campo                      | Ficheiro                             |
| -------------------------- | ------------------------------------ |
| Pacote de instalação       | ZIP do navegador em dist/            |
| Ícone Chrome/Firefox       | icons/icon-128.png                   |
| Ícone Edge                 | icons/icon-300.png                   |
| Capturas, por ordem        | screenshots/01... a 05... (1280x800) |
| Imagem promocional pequena | promo/small-440x280.png              |
| Imagem promocional larga   | promo/marquee-1400x560.png           |
| Nome e resumo              | metadata/listing-pt-PT.txt           |
| Descrição                  | metadata/description-pt-PT.txt       |
| Privacidade e permissões   | metadata/privacy-and-permissions.md  |
| Instruções de revisão      | metadata/reviewer-notes.txt          |
| Apoio                      | rfsbraz@gmail.com                    |
| Categoria e idioma         | Compras; português de Portugal       |

## Antes da submissão

Aloja os três ficheiros de website/ num site HTTPS público e preenche os URLs em listing.json. Valores null significam que falta configuração. Não uses o repositório privado como página pública. Não foi efetuada publicação nas lojas ou alojamento de páginas.

Confirma a verificação da conta/contacto, visibilidade e países nos painéis. A visibilidade do repositório não determina a visibilidade da extensão nas lojas. Não é incluído vídeo YouTube, que é opcional.

## Imagens e reprodução

As cinco capturas usam componentes reais, com ISBN e preços ilustrativos identificados. Não são prova de preços atuais. A capa de demonstração é uma composição de texto original. A posição/largura do aviso foram ajustadas para apresentação. Não são usados logótipos de lojas ou navegadores, classificações ou recomendações inventadas.

O ícone de 128 px contém desenho de 96 px com margem transparente. Incluem-se outros tamanhos, SVG editável, composições HTML e ferramentas de geração. Capturas e imagens promocionais são PNG opacos. asset-manifest.json regista dimensões.

Os ZIPs de instalação excluem capturas, amostras, ferramentas e credenciais. source/extension/ contém a cópia de código usada nas capturas. As composições HTML usam um servidor local de captura e não são páginas públicas. Executa `npm run store-listing:assets` para reproduzir os materiais. website/ é autónomo e pode ser alojado.

## Especificações oficiais

- [Campos e dimensões](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Ícones e formatos](https://developer.chrome.com/docs/webstore/images)
- [Orientações para imagens](https://developer.chrome.com/docs/webstore/best-listing)
- [Limite da descrição no manifesto](https://developer.chrome.com/docs/extensions/reference/manifest/description)
- [Campos de privacidade](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy)
- [Divulgação de dados e processamento local](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
