// FINANCIAL SAFETY AUDIT — runs the WEBSITE lock rules on a list of cases so the
// pytest suite can check they match the gateway copy (backend/financial_lock.py).
// Run: node tests/verify_financial_lock.ts <cases.json>  → prints a JSON array of rule ids.
import { readFileSync } from 'node:fs';
import { financialLockRule } from '../lib/financial-lock-rules.ts';

type Case = { method: string; path: string; query: string; body: string | null; locked: boolean };
const cases: Case[] = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = cases.map((c) => {
  const raw = c.query ? `${c.path}?${c.query}` : c.path;
  return financialLockRule(c.method, raw, c.body ?? undefined, c.locked)?.id ?? null;
});
process.stdout.write(JSON.stringify(out));
