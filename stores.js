import { referralPartner } from './affiliate.js';

// Research provenance and limitations: docs/store-coverage.md.
const html = (id, name, origin, query, pattern, extra = {}) => ({
  id,
  name,
  origin,
  query,
  pattern,
  mode: 'auto',
  adapter: 'html',
  format: 'print',
  ...extra
});
const manual = (id, name, origin, query, reason, extra = {}) => ({
  id,
  name,
  origin,
  query,
  mode: 'manual',
  reason,
  ...extra
});
const reference = (id, name, reason, extra = {}) => ({
  id,
  name,
  mode: 'reference',
  reason,
  ...extra
});

export const CATALOGUE = [
  html('wook', 'Wook', 'https://www.wook.pt', '/pesquisa?keyword={q}', '/livro/', {
    sample: '9789895701124'
  }),
  html('bertrand', 'Bertrand', 'https://www.bertrand.pt', '/pesquisa/{q}', '/livro/', {
    sample: '9789895701124'
  }),
  html(
    'almedina',
    'Almedina',
    'https://www.almedina.net',
    '/catalogsearch/result/?q={q}',
    '\\.html$',
    { selector: 'a.product-item-link[href]', sample: '9789895701124' }
  ),
  html('bookcover', 'Bookcover', 'https://bookcover.pt', '/?s={q}&post_type=product', '/product/', {
    adapter: 'woo-sku',
    skuIsbn: true,
    sample: '9789899267411'
  }),
  html('continente', 'Continente', 'https://www.continente.pt', '/pesquisa/?q={q}', '/produto/', {
    sample: '9789895701124'
  }),
  html(
    'porto',
    'Porto Editora',
    'https://www.portoeditora.pt',
    '/pesquisa?q={q}',
    '/produtos/ficha/',
    { primaryPrice: '.product-price-content .product-price-sale', sample: '9789723830637' }
  ),
  html(
    'lyvros',
    'Lyvros / LeYa',
    'https://www.lyvros.com',
    '/catalogo?search={q}',
    '^/catalogo/[^/]+/?$',
    { sample: '9789895819812', uncertainStock: true }
  ),
  html('penguin', 'Penguin Livros', 'https://penguinlivros.pt', '/?s={q}', '/loja/.+/livro/', {
    adapter: 'woo-product',
    sample: '9789895968244'
  }),
  html(
    'presenca',
    'Presença',
    'https://www.presenca.pt',
    '/search?q={q}&type=product',
    '/products/',
    { adapter: 'shopify-search', skuIsbn: true, sample: '9789722378543' }
  ),
  html(
    'guerraepaz',
    'Guerra e Paz',
    'https://www.guerraepaz.pt',
    '/?s={q}&post_type=product',
    '/produto/',
    {
      adapter: 'woo-product',
      sample: '9789895764808',
      sampleTitle: 'Os Enigmas dos Crimes de Natal'
    }
  ),
  html('gradiva', 'Gradiva', 'https://www.gradiva.pt', '/?s={q}', '/produto/', {
    adapter: 'woo-product',
    sample: '9789897855320',
    sampleTitle: 'O Genocídio Ocultado'
  }),
  html('relogiodagua', 'Relógio d’Água', 'https://www.relogiodagua.pt', '/?s={q}', '/produto/', {
    adapter: 'woo-product',
    sample: '9789897837449'
  }),
  html(
    'saida',
    'Saída de Emergência',
    'https://www.saidadeemergencia.com',
    '/?s={q}&post_type=product',
    '/produto/',
    {
      primaryPrice: '.summary > .price',
      sample: '9789897108075',
      sampleTitle: 'As Alianças Perdidas',
      uncertainStock: true
    }
  ),
  html(
    'quetzal',
    'Quetzal',
    'https://www.quetzaleditores.pt',
    '/pesquisa?q={q}',
    '/produtos/ficha/',
    { sample: '9789897228919' }
  ),
  html('antigona', 'Antígona', 'https://antigona.pt', '/search?q={q}&type=product', '/products/', {
    adapter: 'shopify-search',
    sample: '9789726084495',
    sampleTitle: 'Marcas de Batom'
  }),
  html('snob', 'Livraria Snob', 'https://www.livrariasnob.pt', '/search?q={q}', '/product/', {
    sample: '9789893678862',
    sampleTitle: 'EXERCÍCIO DE MONTAGEM'
  }),
  html(
    'kingpin',
    'Kingpin Books',
    'https://kingpinbooks.com',
    '/search?q={q}&type=product',
    '/products/',
    { adapter: 'shopify-search', skuIsbn: true, sample: '9789895598571' }
  ),
  html('mbooks', 'mbooks', 'https://mbooks.pt', '/?s={q}&post_type=product', '/produto/', {
    adapter: 'woo-product',
    sample: '9789898297839',
    sampleTitle: 'Transforme-se a si Mesmo até Sexta'
  }),
  html('auchan', 'Auchan', 'https://www.auchan.pt', '/pt/pesquisa?q={q}', '/\\d+\\.html$', {
    sample: '9789895701124'
  }),
  html(
    'blackwells',
    'Blackwell’s',
    'https://blackwells.co.uk',
    '/bookshop/search/?keyword={q}',
    '/bookshop/product/',
    { primaryPrice: '.product__price .product-price--current', sample: '9781037210631' }
  ),
  html(
    'waterstones',
    'Waterstones',
    'https://www.waterstones.com',
    '/books/search/term/{q}',
    '/book/',
    { currencies: ['GBP'], sample: '9781037210631', group: 'international' }
  ),
  html(
    'iberlibro',
    'IberLibro',
    'https://www.iberlibro.com',
    '/servlet/SearchResults?isbn={q}',
    '/bd$',
    {
      marketplace: true,
      sample: '9789895701124',
      group: 'marketplace',
      titleQuery: '/servlet/SearchResults?kn={q}'
    }
  ),
  html(
    'abebooks',
    'AbeBooks',
    'https://www.abebooks.com',
    '/servlet/SearchResults?isbn={q}',
    '/bd$',
    {
      currencies: ['USD', 'EUR', 'GBP'],
      marketplace: true,
      sample: '9789895701124',
      group: 'marketplace',
      titleQuery: '/servlet/SearchResults?kn={q}'
    }
  ),
  manual(
    'fnac',
    'Fnac PT',
    'https://www.fnac.pt',
    '/SearchResult/ResultList.aspx?Search={q}',
    'A loja apresentou uma verificação de acesso. Consulta manual, sem contornar o bloqueio.'
  ),
  manual(
    'amazon',
    'Amazon.es / Kindle',
    'https://www.amazon.es',
    '/s?k={q}',
    'A comparação automática requer integração com a API autorizada. Kindle é outro formato.'
  ),
  manual(
    'kobo',
    'Kobo PT',
    'https://www.kobo.com',
    '/pt/pt/search?query={q}',
    'A pesquisa apresentou uma verificação de acesso. eBooks e audiolivros têm edições próprias.',
    { format: 'digital' }
  ),
  manual(
    'google',
    'Google Play Books',
    'https://play.google.com',
    '/store/search?q={q}&c=books&hl=pt_PT&gl=PT',
    'Formato digital: o ISBN do livro em papel pode surgir como edição relacionada. Preço não misturado com papel.',
    { format: 'digital' }
  ),
  manual(
    'apple',
    'Apple Books',
    'https://books.apple.com',
    '/pt/charts',
    'Catálogo digital; pesquisa e compra na aplicação Apple Books.',
    { format: 'digital' }
  ),
  manual(
    'audible',
    'Audible.es',
    'https://www.audible.es',
    '/search?keywords={q}',
    'Audiolivros identificados por ASIN; assinaturas não equivalem ao preço do livro.',
    { format: 'audio' }
  ),
  html('worten', 'Worten', 'https://www.worten.pt', '/search?query={q}', '/produtos/', {
    adapter: 'worten-search',
    marketplace: true,
    sample: '9788521000518',
    group: 'marketplace',
    titleQuery: '/search?query={q}'
  }),
  html(
    'elcorteingles',
    'El Corte Inglés PT',
    'https://www.elcorteingles.pt',
    '/search/?s={q}',
    '/livros/A',
    { skuIsbn: true, sample: '9789895874132' }
  ),
  manual(
    'tintadachina',
    'Tinta-da-china',
    'https://tintadachina.pt',
    '/?s={q}&post_type=product',
    'A loja apresentou uma verificação de acesso.'
  ),
  html(
    'mundofantasma',
    'Mundo Fantasma',
    'https://mundofantasma.com',
    '/search?q={q}',
    '/produto/',
    { adapter: 'svelte-search', sample: '9781591163596', sampleTitle: 'Naruto Vol. 5' }
  ),
  html('devir', 'Devir', 'https://editoradevir.pt', '/?s={q}&post_type=product', '/livro/', {
    adapter: 'woo-product',
    sample: '9789895598762',
    sampleTitle: 'Ichi the Witch'
  }),
  manual(
    'planeta',
    'Planeta',
    'https://www.planetadelivros.pt',
    '/?textoBuscador={q}',
    'Catálogo editorial que encaminha a compra para Wook, Bertrand e Fnac; não é uma oferta independente.'
  ),
  manual(
    'lello',
    'Livraria Lello',
    'https://livrarialello.pt',
    '/?s={q}',
    'O site atual apresenta visitas e eventos; não foi localizado um catálogo de livros com preço e ISBN.'
  ),
  manual(
    'reread',
    'Re-read',
    'https://www.re-read.com',
    '/?s={q}',
    'Livros usados e lojas físicas; sem oferta online por ISBN confirmada.',
    { group: 'used' }
  ),
  manual(
    'olx',
    'OLX',
    'https://www.olx.pt',
    '/ads/q-{q}/',
    'Classificados: edição e estado precisam de confirmação com o vendedor.',
    { group: 'used' }
  ),
  manual(
    'vinted',
    'Vinted',
    'https://www.vinted.pt',
    '/catalog?search_text={q}',
    'Artigos usados sem ISBN estruturado confirmado; consulta manual.',
    { group: 'used' }
  ),
  manual(
    'custojusto',
    'Custo Justo',
    'https://www.custojusto.pt',
    '/portugal/q/{q}',
    'Classificados sem identificação fiável da edição.',
    { group: 'used' }
  ),
  manual(
    'pingodoce',
    'Pingo Doce',
    'https://www.pingodoce.pt',
    '/on/demandware.store/Sites-pingo-doce-Site/default/Search-Show?q={q}',
    'Loja online ativa; não foi encontrado o livro da amostra por ISBN.'
  ),
  manual(
    'intermarche',
    'Intermarché',
    'https://www.intermarche.pt',
    '/',
    'O site bloqueou o acesso; sem catálogo online de livros confirmado.'
  ),
  manual(
    'cultura',
    'Cultura (França)',
    'https://www.cultura.com',
    '/',
    'Cadeia francesa, sem loja portuguesa confirmada; o site apresentou um bloqueio.'
  ),
  reference(
    'storytel',
    'Storytel',
    'Serviço de assinatura, sem preço de compra individual comparável.',
    { origin: 'https://www.storytel.com/pt' }
  ),
  reference(
    'traca',
    'Traça',
    'traca.pt é atualmente um estúdio de arquitetura, arte e design, não uma livraria.'
  ),
  reference('tigre', 'Tigre de Papel', 'Site em manutenção técnica na data da auditoria.', {
    origin: 'https://tigrepapel.pt'
  }),
  reference(
    'ferin',
    'Ferin',
    'ferin.pt apresenta uma página de domínio estacionado; não foi verificada uma loja ativa.'
  ),
  reference(
    'distopia',
    'Distopia',
    'O domínio testado apresenta uma página de domínio estacionado; não foi verificada uma loja ativa.'
  ),
  reference(
    'drkartoon',
    'Dr. Kartoon',
    'O domínio histórico não respondeu. Não é possível confirmar o catálogo online.'
  ),
  reference(
    'comicheart',
    'Comic Heart',
    'O domínio testado apresentou um erro de certificado. Catálogo online não confirmado.'
  ),
  reference(
    'barata',
    'Livraria Barata',
    'O domínio histórico devolve erro de configuração. A loja física está associada à Fnac.',
    { alias: 'fnac' }
  ),
  reference('bulhosa', 'Bulhosa', 'Domínio à venda; sem loja ativa no endereço indicado.'),
  reference(
    'depository',
    'Book Depository',
    'O antigo endereço encaminha para a Amazon; não é uma loja independente.'
  ),
  reference('dott', 'Dott', 'Encaminha para a Worten.', { alias: 'worten' }),
  reference('jumbo', 'Jumbo', 'Antiga marca da Auchan; o domínio histórico não resolve.', {
    alias: 'auchan'
  }),
  reference(
    'asa',
    'ASA',
    'Chancela LeYa. O domínio antigo não respondeu; procurar o ISBN na Lyvros.',
    { alias: 'lyvros' }
  ),
  reference(
    'leyaonline',
    'LeYa Online',
    'O site atual centra-se em produtos escolares. Livros gerais cobertos pela Lyvros.',
    { alias: 'lyvros', origin: 'https://www.leyaonline.com/pt/' }
  ),
  reference(
    'cavalo',
    'Cavalo de Ferro',
    'Domínio antigo à venda; a chancela é pesquisável no catálogo Penguin.',
    { alias: 'penguin' }
  ),
  reference(
    'elsinore',
    'Elsinore / Companhia das Letras / Alfaguara',
    'Chancelas cobertas por Penguin Livros, sem duplicar ofertas.',
    { alias: 'penguin' }
  ),
  reference(
    'alfarrabistas',
    'Alfarrabistas',
    'Categoria de lojas, não um catálogo único. As fontes usadas identificadas estão listadas separadamente.'
  )
];

export function searchUrl(store, query, byTitle = false) {
  return new URL(
    ((byTitle && store.titleQuery) || store.query || '/').replace('{q}', encodeURIComponent(query)),
    store.origin
  ).href;
}
export const STORES = CATALOGUE.filter(s => s.mode === 'auto').map(s => ({
  ...s,
  product: new RegExp(s.pattern),
  search: q => searchUrl(s, q)
}));
export function storeForUrl(url) {
  try {
    return STORES.find(s => new URL(url).origin === s.origin);
  } catch {
    return undefined;
  }
}

export const DEFAULT_STORE_IDS = Object.freeze([
  'wook',
  'bertrand',
  'almedina',
  'continente',
  'porto',
  'presenca'
]);
export function selectedStoreIds(value) {
  return Array.isArray(value)
    ? value.filter(id => STORES.some(s => s.id === id))
    : [...DEFAULT_STORE_IDS];
}

export function hasActiveReferral(storeOrId) {
  const listed =
    typeof storeOrId === 'string'
      ? CATALOGUE.find(s => s.id === storeOrId)
      : storeOrId?.id
        ? CATALOGUE.find(s => s.id === storeOrId.id)
        : undefined;
  const store = listed || (typeof storeOrId === 'object' && storeOrId) || undefined;
  return Boolean(store?.origin && referralPartner(store.origin));
}
