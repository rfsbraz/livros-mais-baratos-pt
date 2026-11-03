import { start } from './content-main.js';
if (!globalThis.lmbStarting) {
  globalThis.lmbStarting = true;
  start();
}
