import { STORES } from '../stores.js';

// Stable slots avoid a late check today followed by an early check tomorrow.
export function dailySchedule() {
  return [...STORES]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((store, index) => ({
      store: store.id,
      hour: Math.floor((index * 24) / STORES.length)
    }));
}

export function selectedStores(args, time = new Date()) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--hourly')) {
    return dailySchedule()
      .filter(s => s.hour === time.getUTCHours())
      .map(s => s.store);
  }
  if (args.length === 1 && args[0] === '--all') {
    return STORES.map(s => s.id);
  }
  if (args.some(id => !STORES.some(s => s.id === id))) {
    throw new Error('Use --hourly, --all, or valid store IDs');
  }
  return [...new Set(args)];
}
