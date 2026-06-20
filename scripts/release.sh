#!/usr/bin/env bash
#
# Cut a new release: bumps version in app/package.json, commits, tags, pushes.
# Tag push triggers .github/workflows/release.yml to build mac/win/linux
# installers via electron-builder on CI.
#
# Usage: ./scripts/release.sh 0.2.0

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <version>" >&2
  echo "Example: $0 0.2.0" >&2
  exit 1
fi

VERSION="$1"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then
  echo "ERROR: version must be semver, e.g. 0.2.0" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree not clean. Commit or stash first." >&2
  exit 1
fi

echo "==> Bumping version to $VERSION"

# app/package.json （Electron 全栈唯一版本源）
sed -i.bak -E "s/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/" app/package.json
rm app/package.json.bak

git add app/package.json
git commit -m "chore: bump version to $VERSION"
git tag "v$VERSION"

echo ""
echo "==> Tagged v$VERSION"
echo "==> Pushing to origin (this will trigger GitHub Actions)"
git push origin main
git push origin "v$VERSION"

echo ""
echo "==> Done! Watch the CI build at:"
echo "    https://github.com/NAMEWTA/eidon/actions"
echo ""
echo "CI builds macOS (.dmg) + Windows (.exe/.msi) + Linux (.deb/.rpm) via electron-builder."
echo "Download artifacts from the Actions run summary page."
