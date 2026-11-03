#!/usr/bin/env bash
# Type-checks the ```ts snippets of the references that are written to compile together,
# plus guard assertions (@ts-expect-error) that prove the type-level rules are not vacuous.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REF="$ROOT/typescript-domain-driven-design/references"
OUT="$(mktemp -d)"
FILES=(typescript-modeling error-handling anti-corruption-layer assemblers contracts-and-published-language query-side consistency-and-sagas)
extract() { awk '/^```ts$/{f=1;next} /^```$/{f=0} f' "$1" | grep -v '^import '; }
{ echo 'import { z } from "zod";'; for f in "${FILES[@]}"; do extract "$REF/$f.md"; done; } > "$OUT/snippets.ts"
cp "$ROOT/scripts/snippet-guards.ts" "$OUT/guards.ts"
cat > "$OUT/package.json" <<'JSON'
{ "name": "snippet-check", "private": true, "type": "module" }
JSON
cat > "$OUT/tsconfig.json" <<'JSON'
{ "compilerOptions": { "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true, "noPropertyAccessFromIndexSignature": true, "useUnknownInCatchVariables": true,
  "noEmit": true, "target": "es2022", "module": "esnext", "moduleResolution": "bundler", "skipLibCheck": true, "types": [] },
  "files": ["snippets.ts", "guards.ts"] }
JSON
cd "$OUT"
bun add zod@4 >/dev/null 2>&1
bun add -d typescript@6.0.3 >/dev/null 2>&1
./node_modules/.bin/tsc -p . && echo "snippets (${#FILES[@]} references) + guards: tsc strict OK"
bun run guards.ts
