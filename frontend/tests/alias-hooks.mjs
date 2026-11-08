// Node resolve hooks for running App Router route handlers in plain Node tests:
// maps the `@/` tsconfig alias and extensionless project imports to real files.
// Used only by tests/verify_login_resilience.ts.
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const EXTS = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts'];

function isFile(u) {
  try {
    return statSync(fileURLToPath(u)).isFile();
  } catch {
    return false;
  }
}

export async function resolve(spec, ctx, next) {
  // `next/server` / `next/headers` ship as extensionless CJS entry points.
  if (/^next\/(server|headers)$/.test(spec)) return next(`${spec}.js`, ctx);
  let base = null;
  if (spec.startsWith('@/')) base = new URL(spec.slice(2), ROOT);
  else if (/^\.\.?\//.test(spec) && ctx.parentURL?.startsWith(ROOT.href)) base = new URL(spec, ctx.parentURL);
  if (base && !base.pathname.includes('/node_modules/')) {
    for (const ext of EXTS) {
      const u = new URL(base.href + ext);
      if (isFile(u)) return next(u.href, ctx);
    }
  }
  return next(spec, ctx);
}
