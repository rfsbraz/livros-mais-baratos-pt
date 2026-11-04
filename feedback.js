import { STORE_URLS } from './store-links.js';
export function detectBrowser(ua = navigator.userAgent) {
  if (ua.includes('Firefox/')) {
    return 'firefox';
  }
  if (ua.includes('Edg/')) {
    return 'edge';
  }
  return 'chrome';
}
export function feedbackLinks(version, ua = navigator.userAgent) {
  const browser = detectBrowser(ua);
  const issue = new URL('https://github.com/rfsbraz/livros-mais-baratos-pt/issues/new');
  issue.searchParams.set('template', 'bug_report.yml');
  issue.searchParams.set('environment', `${browser} · Extensão ${version}`);
  return { rate: STORE_URLS[browser], issue: issue.href };
}
export function initFeedback() {
  const version = chrome.runtime.getManifest().version;
  const links = feedbackLinks(version);
  document.getElementById('rate-link').href = links.rate;
  document.getElementById('report-link').href = links.issue;
  document.getElementById('version').textContent = `v${version}`;
}
