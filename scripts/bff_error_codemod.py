#!/usr/bin/env python3
"""Codemod: wrap every BFF error expression in toErrorText() so a FastAPI 422
(array of {loc,msg}) can never render as "[object Object]".

Transforms (per line, anchored to `error:`):
  T1  error: (<EXPR> || 'FB').toString()   -> error: toErrorText(<EXPR>, 'FB')
  T2  error: <EXPR> || 'FB'  (before })    -> error: toErrorText(<EXPR>, 'FB')
Then ensures `toErrorText` is imported from '@/lib/server/bff'.
"""
import re
import glob

ROOT = '/app/frontend/app/bff'

# T1: parenthesised + .toString()
T1 = re.compile(r"error:\s*\((.+?)\s*\|\|\s*'([^']*)'\)\.toString\(\)")
# T2: bare chain ending in a quoted fallback right before a closing brace
T2 = re.compile(r"error:\s*(?!toErrorText\()([^,{}]*?)\s*\|\|\s*'([^']*)'(?=\s*\})")

BFF_IMPORT = re.compile(r"import\s*\{([^}]*)\}\s*from\s*'@/lib/server/bff';")
FIRST_IMPORT = re.compile(r"^import .*?;\s*$", re.MULTILINE)

changed_files = []
total_repl = 0

for path in sorted(glob.glob(f"{ROOT}/**/route.ts", recursive=True)):
    with open(path, 'r', encoding='utf-8') as f:
        orig = f.read()
    text = orig
    n1 = 0
    n2 = 0

    def r1(m):
        global n1
        n1 += 1
        return f"error: toErrorText({m.group(1)}, '{m.group(2)}')"
    text = T1.sub(r1, text)

    def r2(m):
        global n2
        n2 += 1
        return f"error: toErrorText({m.group(1)}, '{m.group(2)}')"
    text = T2.sub(r2, text)

    if n1 == 0 and n2 == 0:
        continue  # nothing to do

    # Ensure toErrorText is imported.
    already = re.search(r"import[^;]*\btoErrorText\b[^;]*from '@/lib/server/bff';", text)
    if not already:
        m = BFF_IMPORT.search(text)
        if m:
            names = [s.strip() for s in m.group(1).split(',') if s.strip()]
            if 'toErrorText' not in names:
                names.append('toErrorText')
            new_import = "import { " + ", ".join(names) + " } from '@/lib/server/bff';"
            text = text[:m.start()] + new_import + text[m.end():]
        else:
            fm = FIRST_IMPORT.search(text)
            inject = "import { toErrorText } from '@/lib/server/bff';\n"
            if fm:
                text = text[:fm.end()] + "\n" + inject.rstrip("\n") + text[fm.end():]
            else:
                text = inject + text

    if text != orig:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        rel = path.replace('/app/frontend/', '')
        changed_files.append((rel, n1, n2))
        total_repl += n1 + n2

print(f"Files changed: {len(changed_files)}   Total replacements: {total_repl}\n")
for rel, a, b in changed_files:
    print(f"  {rel:70s}  T1={a} T2={b}")
