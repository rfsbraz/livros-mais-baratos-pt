// Add future partners here; comparison requests and stored offers stay unchanged.
const PARTNERS = {
  'www.wook.pt': { parameter: 'a_aid', value: '5d3ee4327c2fd' },
  'www.bertrand.pt': { parameter: 'a_aid', value: '5d3f094d9af11' },
  'mbooks.pt': { parameter: 'wpam_id', value: '163' }
};

export function affiliateUrl(raw, enabled) {
  if (!enabled) {
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

/** Metric name for an outbound click, or null when the click is not counted. */
export function affiliateClickMetric(href, enabled) {
  if (enabled && /[?&](?:a_aid|wpam_id)=/.test(href)) {
    return 'affiliate_click';
  }
  try {
    if (new URL(href).hostname === 'www.wook.pt') {
      return 'wook_click_no_affiliate';
    }
  } catch {
    return null;
  }
  return null;
}

const originals = new WeakMap();
const listening = new WeakSet();

export function refreshAffiliateLinks(enabled, root = globalThis.document) {
  const links = root?.querySelectorAll?.('a') || [];
  for (const link of links) {
    const original = originals.get(link);
    if (original) {
      link.href = affiliateUrl(original, enabled);
    }
  }
}

export function bindAffiliateLink(link, enabled, onNavigate) {
  originals.set(link, link.href);
  const sync = () => {
    const original = originals.get(link);
    if (original) {
      link.href = affiliateUrl(original, enabled());
    }
  };
  sync();
  if (listening.has(link)) {
    return;
  }
  listening.add(link);
  // The preference can change while the link is on screen, so follow it before it is opened or copied.
  for (const type of ['pointerdown', 'click', 'auxclick', 'contextmenu', 'keydown']) {
    link.addEventListener(type, event => {
      if (type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      sync();
    });
  }
  if (onNavigate) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      try {
        onNavigate(link.href, enabled());
      } catch {
        /* Metrics must never block navigation. */
      }
    });
  }
}

export function referralPartner(originOrUrl) {
  try {
    return PARTNERS[new URL(originOrUrl).hostname] || null;
  } catch {
    return null;
  }
}
