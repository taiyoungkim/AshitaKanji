#!/usr/bin/env bash
# GitHub Pages deploy script for AshitaKanji
# Pushes ~/jlpt-app/site/ to gh-pages branch of taiyoungkim/AshitaKanji
#
# Requirements: git, gh CLI (authed) OR SSH key on GitHub.
# Run from anywhere. Idempotent.

set -euo pipefail

REPO_URL="https://github.com/taiyoungkim/AshitaKanji.git"
REPO_SSH="git@github.com:taiyoungkim/AshitaKanji.git"
SITE_DIR="$HOME/AshitaKanji/site"
TMP_DIR="$(mktemp -d)"
BRANCH="gh-pages"

if [ ! -d "$SITE_DIR" ]; then
  echo "ERROR: $SITE_DIR not found" >&2
  exit 1
fi

echo "==> Clone repo to $TMP_DIR"
cd "$TMP_DIR"
# Try HTTPS first, fall back to SSH
git clone "$REPO_URL" repo 2>/dev/null || git clone "$REPO_SSH" repo
cd repo

# Switch to gh-pages branch (create orphan if missing)
if git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "==> Checkout existing $BRANCH"
  git checkout "$BRANCH"
  git rm -rf . 2>/dev/null || true
else
  echo "==> Create orphan $BRANCH"
  git checkout --orphan "$BRANCH"
  git rm -rf . 2>/dev/null || true
fi

echo "==> Copy site contents"
cp -R "$SITE_DIR"/. ./
ls -la

echo "==> Commit"
git add -A
git -c user.email="datin0214@gmail.com" -c user.name="taiyoungkim" \
    commit -m "Deploy GitHub Pages: privacy + support + landing"

echo "==> Push to $BRANCH"
git push -u origin "$BRANCH"

echo ""
echo "✅ Pushed. Next steps (manual):"
echo "  1. Open https://github.com/taiyoungkim/AshitaKanji/settings/pages"
echo "  2. Source = Deploy from a branch"
echo "  3. Branch = gh-pages, Folder = / (root)"
echo "  4. Save. Wait 1-2 min."
echo "  5. Verify:"
echo "     curl -I https://taiyoungkim.github.io/AshitaKanji/"
echo "     curl -I https://taiyoungkim.github.io/AshitaKanji/privacy/"
echo "     curl -I https://taiyoungkim.github.io/AshitaKanji/support/"
echo ""
echo "Cleanup tmp:"
echo "  rm -rf $TMP_DIR"
