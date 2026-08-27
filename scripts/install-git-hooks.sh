#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
HOOKS="$(git rev-parse --git-path hooks)"
mkdir -p "$HOOKS"

cat > "$HOOKS/pre-commit" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
branch="$(git branch --show-current)"
case "$branch" in error-budgets-data/*) ;; *) exit 0 ;; esac
id="${branch#error-budgets-data/}"
path="public/error-budgets/data/operations/${id}.json"
if ! git diff --cached --name-only --diff-filter=ACMR | grep -Fxq "$path"; then exit 0; fi
validator="$(mktemp --suffix=.mjs)"; payload="$(mktemp --suffix=.json)"; trap 'rm -f "$validator" "$payload"' EXIT
git show origin/main:public/error-budgets/scripts/validate-operation.mjs > "$validator" || { echo 'ERROR: cannot load validator from origin/main'; exit 1; }
git show ":$path" > "$payload" || { echo "ERROR: staged $path not found"; exit 1; }
node "$validator" "$payload" --expected-id "$id" --expected-branch "$branch"
EOF

cat > "$HOOKS/pre-push" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
branch="$(git branch --show-current)"
case "$branch" in error-budgets-data/*) ;; *) exit 0 ;; esac
id="${branch#error-budgets-data/}"
path="public/error-budgets/data/operations/${id}.json"
validator="$(mktemp --suffix=.mjs)"; payload="$(mktemp --suffix=.json)"; trap 'rm -f "$validator" "$payload"' EXIT
git show origin/main:public/error-budgets/scripts/validate-operation.mjs > "$validator" || { echo 'ERROR: cannot load validator from origin/main'; exit 1; }
git show "HEAD:$path" > "$payload" || { echo "ERROR: committed $path not found"; exit 1; }
node "$validator" "$payload" --expected-id "$id" --expected-branch "$branch"
EOF

chmod +x "$HOOKS/pre-commit" "$HOOKS/pre-push"
echo "Installed strict Error Budgets pre-commit and pre-push hooks in $HOOKS"
