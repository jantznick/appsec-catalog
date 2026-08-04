#!/usr/bin/env bash
#
# osv-prod.sh — run OSV-Scanner on an npm project and show PRODUCTION-only
# vulnerabilities (dev/optional dependencies excluded), grouped by package.
#
# OSV-Scanner has no built-in dev-exclude flag, so we scan with --format json
# and filter on npm's own `dependency_groups` field via jq.
#
# Usage:
#   ./osv-prod.sh [path]        # path to a dir containing package-lock.json (default: .)
#   ./osv-prod.sh backend
#   ./osv-prod.sh frontend
#
# Requires: osv-scanner, jq
set -euo pipefail

TARGET="${1:-.}"

# Resolve the lockfile
if [[ -f "$TARGET" ]]; then
  LOCKFILE="$TARGET"
elif [[ -f "$TARGET/package-lock.json" ]]; then
  LOCKFILE="$TARGET/package-lock.json"
else
  echo "error: no package-lock.json found at '$TARGET'" >&2
  exit 1
fi

command -v osv-scanner >/dev/null || { echo "error: osv-scanner not installed" >&2; exit 1; }
command -v jq >/dev/null || { echo "error: jq not installed" >&2; exit 1; }

echo "Scanning (production deps only): $LOCKFILE"
echo

# osv-scanner exits non-zero when it finds vulns; capture output and swallow that
# exit so the report always prints and the script doesn't abort under `set -e`.
RAW="$(osv-scanner scan --lockfile "$LOCKFILE" --format json 2>/dev/null || true)"

echo "$RAW" | jq -r '
    [ .results[].packages[]
      | select( (.dependency_groups // []) | index("dev") | not ) ] as $prod
    | "PRODUCTION-ONLY (dev/optional-dev deps excluded)",
      "  packages affected: \($prod | length)",
      "  vulnerabilities:   \([ $prod[].groups[] ] | length)",
      "",
      ( $prod[]
        | "  \(.package.name)@\(.package.version)  —  \(.groups | length) vulns (max CVSS \([.groups[].max_severity | tonumber] | max))" )
  '
