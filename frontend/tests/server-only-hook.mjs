// Node resolve hook for route-handler tests: Next.js provides `server-only` internally (it
// is not an installed package), so plain Node gets an empty module for it.
export async function resolve(spec, ctx, next) {
  if (spec === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
  return next(spec, ctx);
}
