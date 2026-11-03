// Dynamic registration runs this only on shops the user has authorized.
if (!globalThis.lmbStarting) {
  globalThis.lmbStarting = true;
  import(chrome.runtime.getURL('content-main.js')).then(module => module.start()).catch(() => { globalThis.lmbStarting = false; });
}
