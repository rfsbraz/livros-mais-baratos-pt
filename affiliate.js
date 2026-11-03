// Add future partners here; comparison requests and stored offers stay unchanged.
const PARTNERS = { 'www.wook.pt': { parameter: 'a_aid', value: '5d3ee4327c2fd' } };

export function affiliateUrl(raw, enabled, eligible) {
  if (!enabled || !eligible) {
    return raw;
  }
  try {
    const url = new URL(raw),
      partner = PARTNERS[url.hostname];
    if (!partner || url.protocol !== 'https:' || url.username || url.password || url.port) {
      return raw;
    }
    // Preserve attribution already present on the destination.
    if (url.searchParams.has(partner.parameter)) {
      return raw;
    }
    url.searchParams.set(partner.parameter, partner.value);
    return url.href;
  } catch {
    return raw;
  }
}

export function bindAffiliateLink(link, enabled, eligible) {
  const original = link.href;
  const activate = event => {
    if (!event.isTrusted || (event.type === 'auxclick' && event.button !== 1)) {
      return;
    }
    link.href = affiliateUrl(original, enabled(), eligible);
    // Keep copied/context-menu links clean. Only a deliberate click adds attribution.
    setTimeout(() => {
      link.href = original;
    }, 0);
  };
  link.addEventListener('click', activate);
  link.addEventListener('auxclick', activate);
}
