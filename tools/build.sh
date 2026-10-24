#!/usr/bin/env bash
# Builds the .zab for the Zepp App Store (or a release) into dist/.
# `zeus build` can overwrite .gitignore with the Zeus template, which would drop the entries
# that keep TODO.md, CHANGELOG.de.md and BESCHREIBUNG.md local; the old .gitignore is put back
# afterwards, also when the build fails.
# --github: without the intermediate products (.ip-package, over 1 MB), for the GitHub release;
# the .zab then holds only the finished app per screen size. Keep them for the Zepp App Store,
# which uses them to repackage the app for other watches with the same screen.
# Usage: npm run build [-- --github]   (or: bash tools/build.sh [--github])
set -euo pipefail
cd "$(dirname "$0")/.."

saved=$(mktemp)
cp .gitignore "$saved"
trap 'cp "$saved" .gitignore; rm -f "$saved"' EXIT

npm run check
zeus build
if [ "${1:-}" = --github ]; then zeus prune --ip </dev/null; fi

echo
grep -o '"appId": [0-9]*' app.json
grep -A1 '"code"' app.json | tr -d ' \n' && echo
ls -l dist/*.zab
