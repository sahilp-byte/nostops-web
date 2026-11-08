// Dev-only guard for the Next.js dev cache (.next/dev/cache). It has filled the /app disk before
// (ENOSPC crashed both the website and the API). Loaded by next.config.mjs for `next dev` only;
// `next build` / `next start` (production) never run it.
//  • At start-up, before Turbopack opens its cache: if the cache is over 1.5 GB, or less than
//    2 GB of disk is free, the cache folder is removed. Next rebuilds it on demand.
//  • Every 10 minutes: the fetch / image caches are cleared when they pass 0.3 GB. If the
//    Turbopack cache passes 3 GB, or the disk is nearly full while that cache is large, the dev
//    server restarts itself (exit code 77 makes `next dev` restart its worker), which runs the
//    start-up clean-up. Files that are still open can't free space, so a restart is the safe way.
import fs from 'node:fs';
import path from 'node:path';

const GB = 1024 ** 3;
const CACHE = path.join(process.cwd(), '.next', 'dev', 'cache');
const START_LIMIT = 1.5 * GB;
const RUN_LIMIT = 3 * GB;
const SMALL_LIMIT = 0.3 * GB;
const MIN_FREE_START = 2 * GB;
const MIN_FREE_RUN = 1 * GB;
const WORTH_RESTART = 0.5 * GB;
const EVERY_MS = 10 * 60 * 1000;

function dirSize(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else {
        try {
          total += fs.statSync(p).size;
        } catch {
          /* file vanished */
        }
      }
    }
  }
  return total;
}

function freeBytes() {
  try {
    const s = fs.statfsSync(process.cwd());
    return s.bavail * s.bsize;
  } catch {
    return Infinity;
  }
}

const gb = (n) => `${(n / GB).toFixed(2)} GB`;

function remove(p, why) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
    console.log(`[dev-cache-guard] cleared ${path.relative(process.cwd(), p)} (${why})`);
  } catch (e) {
    console.warn(`[dev-cache-guard] could not clear ${p}: ${e?.message || e}`);
  }
}

export function startDevCacheGuard() {
  if (globalThis.__nostopsDevCacheGuard) return;
  globalThis.__nostopsDevCacheGuard = true;

  const size = dirSize(CACHE);
  const free = freeBytes();
  if (size > START_LIMIT || free < MIN_FREE_START) remove(CACHE, `cache ${gb(size)}, disk free ${gb(free)}`);

  // Only the forked dev-server worker (it has an IPC channel) may restart itself.
  const isWorker = typeof process.send === 'function';
  const timer = setInterval(() => {
    for (const sub of ['fetch-cache', 'images']) {
      const p = path.join(CACHE, sub);
      if (dirSize(p) > SMALL_LIMIT) remove(p, 'over 0.3 GB');
    }
    if (!isWorker) return;
    const turbo = dirSize(path.join(CACHE, 'turbopack'));
    const left = freeBytes();
    if (turbo > RUN_LIMIT || (left < MIN_FREE_RUN && turbo > WORTH_RESTART)) {
      console.warn(`[dev-cache-guard] Turbopack cache ${gb(turbo)}, disk free ${gb(left)}: restarting the dev server to clear it`);
      process.exit(77);
    }
  }, EVERY_MS);
  timer.unref?.();
}
