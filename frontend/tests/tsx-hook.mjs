// Node module hooks for rendering client components in plain Node tests (Prompt 4D):
//   • .tsx files are transpiled in memory with the project's TypeScript (JSX → react/jsx-runtime);
//   • `next/link` is replaced by a plain <a> (no Next.js router exists outside a Next request).
// Register AFTER alias-hooks.mjs. Nothing is written to disk.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const LINK_STUB = new URL('./next-link-stub.mjs', import.meta.url).href;

export async function resolve(spec, ctx, next) {
  if (spec === 'next/link' || spec === 'next/link.js') return { url: LINK_STUB, shortCircuit: true };
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (!url.startsWith('file:') || !url.endsWith('.tsx')) return next(url, ctx);
  const source = await readFile(fileURLToPath(url), 'utf8');
  const out = ts.transpileModule(source, {
    fileName: fileURLToPath(url),
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return { format: 'module', source: out.outputText, shortCircuit: true };
}
