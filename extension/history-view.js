import { STORES } from './stores.js';
const ns = 'http://www.w3.org/2000/svg';
const money = (n, currency) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency }).format(n / 100);
function svgElement(tag, attributes, text) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text) node.textContent = text;
  return node;
}
export function renderHistoryChart(container, points) {
  container.replaceChildren();
  const valid = points.filter(p => Number.isSafeInteger(p.price) && p.price > 0 && Number.isFinite(p.at) && p.at <= Date.now());
  if (!valid.length) { container.textContent = 'Ainda não há observações. Compara este livro para começar o histórico.'; return; }
  const groups = Map.groupBy(valid, p => [p.store, p.currency || 'EUR', p.condition || 'NewCondition'].join('/'));
  const select = document.createElement('select'); select.setAttribute('aria-label', 'Loja e edição do gráfico');
  for (const [key] of groups) {
    const [id, currency, condition] = key.split('/');
    const option = document.createElement('option'); option.value = key;
    option.textContent = (STORES.find(s => s.id === id)?.name || id) + ' · ' + currency + ' · ' + (condition === 'NewCondition' ? 'novo' : condition === 'UsedCondition' ? 'usado' : 'estado por confirmar');
    select.append(option);
  }
  const chart = document.createElement('div'); container.append(select, chart);
  const draw = () => {
    chart.replaceChildren();
    const values = [...groups.get(select.value)].sort((a, b) => a.at - b.at);
    const currency = select.value.split('/')[1], low = Math.min(...values.map(p => p.price)), high = Math.max(...values.map(p => p.price));
    const text = document.createElement('p'); text.className = 'history-summary';
    text.textContent = values.length + ' observações · mínimo ' + money(low, currency) + ' · último ' + money(values.at(-1).price, currency);
    chart.append(text);
    const svg = svgElement('svg', { viewBox: '0 0 360 165', role: 'img', 'aria-label': 'Preços observados nesta instalação. ' + text.textContent });
    const first = values[0].at, last = values.at(-1).at;
    const x = p => last === first ? 180 : 40 + (p.at - first) / (last - first) * 300;
    const y = p => high === low ? 75 : 18 + (high - p.price) / (high - low) * 100;
    svg.append(svgElement('polyline', { points: values.map(p => x(p) + ',' + y(p)).join(' '), fill: 'none', stroke: '#2458bb', 'stroke-width': 2 }));
    for (const p of values) {
      const point = svgElement('circle', { cx: x(p), cy: y(p), r: 3, fill: '#16624a' });
      point.append(svgElement('title', {}, new Date(p.at).toLocaleString('pt-PT') + ': ' + money(p.price, currency)));
      svg.append(point);
    }
    for (const [value, xPos, yPos, anchor] of [[money(high, currency), 4, 12, 'start'], [money(low, currency), 4, 135, 'start'],
      [new Date(first).toLocaleDateString('pt-PT'), 40, 158, 'start'], [new Date(last).toLocaleDateString('pt-PT'), 340, 158, 'end']]) {
      svg.append(svgElement('text', { x: xPos, y: yPos, 'text-anchor': anchor, 'font-size': 10, fill: '#536278' }, value));
    }
    chart.append(svg);
    const details = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = 'Ver últimas observações'; details.append(summary);
    const table = document.createElement('table'), head = document.createElement('tr');
    for (const name of ['Data', 'Preço do livro', 'Origem']) { const th = document.createElement('th'); th.textContent = name; head.append(th); } table.append(head);
    for (const p of values.slice(-12).reverse()) {
      const row = document.createElement('tr');
      for (const value of [new Date(p.at).toLocaleString('pt-PT'), money(p.price, currency), p.source === 'scheduled' ? 'Agendada' : 'Comparação manual']) {
        const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
      }
      table.append(row);
    }
    details.append(table); chart.append(details);
  };
  select.onchange = draw; draw();
}
