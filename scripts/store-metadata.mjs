import { mkdir, writeFile, cp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { STORES } from '../stores.js';
const version = JSON.parse(await readFile('package.json', 'utf8')).version;
const out = resolve(process.env.STORE_OUTPUT || 'store-listing');
for (const dir of ['metadata', 'website', 'source']) {
  await mkdir(out + '/' + dir, { recursive: true });
}
const config = JSON.parse(await readFile('store-listing/listing.json', 'utf8'));
const pt = JSON.parse(await readFile('store-listing/locales/pt-PT.json', 'utf8'));
const summary = pt.summary;
const description = pt.description.join('\n');
await writeFile(
  `${out}/metadata/listing-pt-PT.txt`,
  `Nome\nLivros Mais Baratos PT\n\nResumo (${summary.length}/132 caracteres)\n${summary}\n\nDescrição detalhada\n${description}\n`
);
await writeFile(`${out}/metadata/description-pt-PT.txt`, description + '\n');
await writeFile(`${out}/metadata/summary-pt-PT.txt`, summary + '\n');
await writeFile(
  `${out}/metadata/listing.json`,
  JSON.stringify(
    {
      name: 'Livros Mais Baratos PT',
      version,
      defaultLanguage: 'pt-PT',
      category: 'Shopping',
      price: 'Free',
      supportEmail: 'rfsbraz@gmail.com',
      automaticAlertsEnabledByDefault: true,
      affiliateLinksEnabledByDefault: true,
      affiliatePartners: [{ store: 'wook', parameter: 'a_aid', id: '5d3ee4327c2fd' }],
      hostPermissionModel: 'installation',
      preserveSavedDisabledPreference: true,
      summary,
      description,
      interfaceLanguages: ['pt-PT'],
      privacyPolicyUrl: config.privacyPolicyUrl,
      supportUrl: config.supportUrl,
      homepageUrl: config.homepageUrl,
      youtubeVideoUrl: null,
      websiteVerified: false,
      distribution: 'Ainda não submetida; escolher visibilidade e países no painel de publicação',
      screenshots: [
        '01-aviso-automatico',
        '02-comparar-edicao',
        '03-definicoes',
        '04-estante-historico',
        '05-precos-alvo'
      ].map(s => `screenshots/${s}-1280x800.png`)
    },
    null,
    2
  )
);
const privacy = `# Política de privacidade

Livros Mais Baratos PT · Versão ${version} · Atualizada em 10 de novembro de 2026

Responsável pela extensão: Rodrigo Braz. Contacto: rfsbraz@gmail.com.

## Finalidade

A extensão compara preços da mesma edição de um livro por ISBN, mostra avisos automáticos de ofertas mais baratas e guarda uma estante e um histórico local das comparações manuais e agendadas.

## Dados tratados no navegador

Na comparação manual, a extensão lê a página atual após a abrires. Os avisos estão ativos por predefinição após a instalação, identificando páginas de livro nas lojas selecionadas com o acesso autorizado pelo navegador. Não é necessário abrir a extensão para iniciar estas consultas. O URL e o conteúdo da página são processados localmente para obter o ISBN, título, preço, moeda e disponibilidade. Não recolhe o histórico geral de navegação nem envia o HTML da página para um servidor do responsável.

Os ISBN, títulos guardados, preços-alvo, notificações, preços observados, preferências de lojas e estado dos avisos são guardados no armazenamento local da extensão, não no Chrome Sync. As ações de guardar/remover livros e escolher lojas servem apenas para executar estas funções. Não há registo de movimentos do rato nem de texto digitado. Contadores anónimos de desempenho e de cliques em ligações Wook (com ou sem afiliado) só são enviados se as estatísticas estiverem ativas.

## Ligações às lojas

Ao comparar, a extensão envia o ISBN e, quando necessário, o título diretamente às lojas selecionadas. Estas recebem também informações normais da ligação, incluindo o endereço IP. Os pedidos usam HTTPS e não enviam cookies de sessão. As lojas tratam os pedidos de acordo com as suas próprias políticas de privacidade. Abrir uma ligação de oferta usa o navegador normal, sujeito às permissões e cookies desse site. A extensão não efetua compras nem trata dados de pagamento.

A extensão não tem conta de utilizador. Envia estatísticas anónimas de desempenho para um serviço próprio na Cloudflare enquanto a opção correspondente estiver ativa, o que acontece por predefinição. Podes desativá-la em Definições; no Firefox a recolha depende também da permissão de dados técnicos e de interação. Não inclui ISBN, títulos, URLs, preços nem identificadores de instalação. Não vendemos dados, não os usamos para publicidade ou avaliação de crédito e não os transferimos para fins alheios à comparação de preços solicitada pelo utilizador.

## Afiliados opcionais

A preferência local Considerar vales Wook na comparação está ativa por predefinição e pode ser desativada. Calcula um equivalente estimado a partir das condições confirmadas, sem alterar os preços reais guardados nem os alvos.

A opção Apoiar através de ligações de afiliado está ativa por predefinição e pode ser desativada na extensão. Esta preferência fica guardada localmente, incluindo após atualizações e ao apagar a estante. Enquanto a opção estiver ativa, as ligações para a Wook, a Bertrand e a mbooks mostradas pela extensão, incluindo ofertas mais caras, «Saber mais» (Wook) e ligações copiadas, incluem o identificador do parceiro (a_aid=5d3ee4327c2fd na Wook; a_aid=5d3f094d9af11 na Bertrand; wpam_id=163 na mbooks). Não substituímos identificadores já presentes. Os pedidos de comparação e a ordenação não dependem de comissões. A Wook recebe o identificador após o clique e pode usar cookies segundo a sua própria política. Podemos receber uma comissão. Desativar impede futuras adições, mas não apaga cookies já definidos pela Wook.

## Conservação

A estante suporta até 100 livros. O histórico suporta até 200 edições e 360 observações por edição. Quando voltas a comparar uma edição, as suas observações com mais de 90 dias são removidas. Históricos de livros que não voltas a consultar podem permanecer até serem substituídos pelo limite de 200 edições ou apagados por ti.

As consultas automáticas usam uma cache em memória com até 50 combinações de edição e lojas. Os resultados podem ser reutilizados durante dez minutos. Não são gravados no histórico. Desativar os avisos ou alterar as lojas autorizadas fecha o documento que processa as consultas, cancela os seus pedidos e limpa a cache em memória. Os preços confirmados também ficam guardados localmente para o menu, até 50 ISBNs. O menu exclui resultados com mais de 24 horas e assinala preços com mais de dez minutos como potencialmente desatualizados. As entradas expiradas são removidas na próxima gravação; Apagar dados elimina toda a cache. Fechar um aviso suprime-o para esse ISBN no documento atual da página.

## Controlo e eliminação

O acesso às lojas é solicitado na instalação e os avisos automáticos estão inicialmente ativos. Uma preferência anterior de desativação é preservada nas atualizações. Podes selecionar lojas, desativar os avisos e revogar permissões nas definições do navegador. A opção Apagar dados elimina a estante e o histórico, repõe a seleção de lojas e desativa os avisos. Desinstalar a extensão remove o armazenamento local. Livros com alvo ativo têm verificações aproximadamente diárias enquanto o navegador está aberto. Alvos e preferências são guardados localmente.

## Contacto de suporte

Se enviares uma mensagem para rfsbraz@gmail.com, os dados que incluíres no email são usados para responder ao pedido de suporte. Esse contacto é separado do funcionamento da extensão. Não envies palavras-passe, dados de pagamento ou informação pessoal desnecessária. Podes usar o mesmo contacto para pedir a eliminação da correspondência de suporte.

## Avaliação e comunicação de problemas

As ligações do rodapé só abrem após um clique. A avaliação abre a loja do navegador. O formulário de problemas no GitHub recebe apenas o nome do navegador e a versão da extensão, sem dados do livro, da página visitada, da estante ou do histórico. O utilizador revê o conteúdo e confirma a publicação no GitHub.

## Utilização limitada

O tratamento de dados pela extensão respeita a Política de Dados do Utilizador da Chrome Web Store, incluindo os requisitos de Utilização Limitada. Os dados são usados apenas para as funções de comparação, avisos e estante descritas ao utilizador.
`;
const support = `# Suporte

## Contacto

Escreve para rfsbraz@gmail.com. Inclui a versão da extensão, a versão do navegador, a loja e o ISBN afetado. Se enviares uma captura de ecrã, remove primeiro qualquer informação pessoal. Não envies palavras-passe nem dados de pagamento.

## Avisos automáticos sem configuração

Depois de instalar a extensão e aceitar as permissões no Chrome, basta visitar uma página de livro suportada. As consultas decorrem em segundo plano, sem abrir a extensão. Se desativaste os avisos anteriormente, podes voltar a ativá-los no botão da extensão. O aviso de menor preço só aparece se o preço atual e uma oferta nova mais barata da mesma edição forem verificáveis em EUR, com stock confirmado na outra loja.

## Porque não aparece um aviso?

Pode não existir uma oferta mais barata. A página pode não identificar a edição ou o preço de forma suportada, ou uma loja pode bloquear o acesso. Páginas de pesquisa, marketplaces e formatos digitais identificados não originam estes avisos. Um livro Wook abrangido por uma campanha de vale reconhecida também pode mostrar um aviso informativo com a poupança combinada e a ligação Saber mais. Confirma as lojas selecionadas e as permissões no Chrome. Podes usar a comparação manual por ISBN e abrir as ligações das lojas.

## Que preço é comparado?

Comparamos apenas o preço do livro. Confirma condições, taxas, disponibilidade e preço final na loja. As consultas automáticas podem reutilizar preços observados nos últimos dez minutos; o aviso indica a hora.

## Como apagar os dados?

Usa Apagar dados na extensão para limpar a estante e o histórico e desativar os avisos. Podes também revogar as permissões nas definições do navegador ou desinstalar a extensão.

## Histórico de preços

O histórico contém só observações desta instalação: comparações manuais e verificações agendadas de alvos. O gráfico mostra o preço do livro por loja, moeda e estado. Não contém dados de terceiros nem preços anteriores. Os avisos ao navegar não acrescentam observações ao histórico.
`;
const esc = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function htmlDoc(markdown, title) {
  return `<!doctype html><html lang="pt-PT"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${title} - Livros Mais Baratos PT"><title>${title} | Livros Mais Baratos PT</title><style>body{font:17px/1.65 system-ui,sans-serif;color:#172e59;background:#fff;margin:0}header{padding:26px max(24px,calc((100% - 780px)/2));background:#172e59;color:#fff}header a{color:#fff;margin-right:20px}main{max-width:780px;margin:48px auto;padding:0 24px 70px}h1{font:42px Georgia,serif}h2{font-size:23px;margin-top:36px}a{color:#2458bb}footer{border-top:1px solid #d8e2f2;padding:24px;color:#536278;text-align:center}</style></head><body><header><strong>Livros Mais Baratos PT</strong><nav><a href="index.html">Início</a><a href="privacy.html">Privacidade</a><a href="support.html">Suporte</a></nav></header><main>${markdown
    .trim()
    .split(/\n\n+/)
    .map(p =>
      p.startsWith('## ')
        ? `<h2>${esc(p.slice(3))}</h2>`
        : p.startsWith('# ')
          ? `<h1>${esc(p.slice(2))}</h1>`
          : `<p>${esc(p).replaceAll('rfsbraz@gmail.com', '<a href="mailto:rfsbraz@gmail.com">rfsbraz@gmail.com</a>')}</p>`
    )
    .join(
      '\n'
    )}</main><footer>Livros Mais Baratos PT · <a href="mailto:rfsbraz@gmail.com">rfsbraz@gmail.com</a></footer></body></html>`;
}
await writeFile(`${out}/website/privacy.html`, htmlDoc(privacy, 'Política de privacidade'));
await writeFile(`${out}/website/support.html`, htmlDoc(support, 'Suporte'));
await writeFile(
  `${out}/website/index.html`,
  htmlDoc(
    `# Livros Mais Baratos PT\n\nO mesmo livro. Um preço melhor.\n\nCompara a mesma edição por ISBN em livrarias portuguesas, recebe automaticamente avisos de ofertas mais baratas e guarda o histórico das tuas consultas neste navegador.\n\n## Como funciona\n\nInstala, aceita as permissões de acesso às lojas e visita um livro. As comparações e os avisos começam automaticamente. Podes ajustar as lojas ou desativar os avisos a qualquer momento. Os avisos exigem um livro novo da mesma edição, em EUR, mais barato e com stock confirmado na outra loja. Comparamos o preço do livro; a disponibilidade e o valor final dependem de cada loja.\n\n## Sem conta\n\nOs dados da estante e do histórico são locais. As consultas enviam o ISBN e, quando necessário, o título às lojas selecionadas. Consulta a política de privacidade para conhecer todos os detalhes.\n\nAfiliados Wook, Bertrand e mbooks ativos por predefinição: ao abrires uma ligação para a Wook, a Bertrand ou a mbooks a partir da extensão podemos receber uma comissão. Podes desativar na extensão.\n\n## Apoio\n\nContacto: rfsbraz@gmail.com.`,
    'Comparar preços de livros'
  )
);
await writeFile(`${out}/metadata/privacy-policy-pt-PT.md`, privacy);
async function template(name) {
  return (await readFile(`store-listing/templates/${name}`, 'utf8'))
    .replaceAll('{{version}}', version)
    .replaceAll('{{hosts}}', STORES.map(s => `- ${s.name}: ${s.origin}/*`).join('\n'));
}
await writeFile(
  `${out}/metadata/privacy-and-permissions.md`,
  await template('privacy-and-permissions.md')
);
await writeFile(`${out}/metadata/reviewer-notes.txt`, await template('reviewer-notes.txt'));
await writeFile(
  `${out}/metadata/release-notes-pt-PT.txt`,
  'Estatísticas anónimas de desempenho e utilização, sem ISBN, títulos, URLs, preços ou identificador persistente. Ativas por predefinição; no Firefox dependem também da permissão de dados técnicos e de interação. Podes desativar em Definições, em Partilhar estatísticas anónimas de desempenho. Preços-alvo com verificações agendadas, gráficos apenas com observações locais. Afiliados Wook opcionais, ativos por predefinição, com divulgação e opção de desativar. Deteção automática por predefinição de páginas de livros, com acesso às lojas solicitado na instalação e avisos de ofertas mais baratas da mesma edição. Seleção de lojas, comparação por ISBN, estante e histórico local de consultas. A cobertura e a disponibilidade dos preços dependem de cada loja.\n'
);
await writeFile(`${out}/README.md`, await template('README.md'));
await cp('scripts/store-assets.mjs', `${out}/source/generate-assets.mjs`);
await cp('scripts/store-metadata.mjs', `${out}/source/generate-metadata.mjs`);
console.log('Metadados, divulgações, instruções de revisão e páginas públicas gerados.');
