#!/bin/bash
# Clean build script - clears cache and rebuilds from scratch
set -e
cd "$(dirname "$0")/.."

# Set clean PATH with node/npm from ~/bin
export PATH="/home/master/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

rm -rf dist node_modules/.vite
npm run build

# Fix file permissions for static files (Vite copies with restrictive permissions)
chmod 644 dist/robots.txt dist/sitemap.xml dist/manifest.json 2>/dev/null || true

# Create symlinks for static files (nginx may bypass Apache rewrites)
cd "$(dirname "$0")/.."
ln -sf dist/icons icons
ln -sf dist/registerSW.js registerSW.js
ln -sf dist/sw.js sw.js
ln -sf dist/manifest.json manifest.json
ln -sf dist/robots.txt robots.txt
ln -sf dist/sitemap.xml sitemap.xml
ln -sf dist/apple-touch-icon.svg apple-touch-icon.svg
# Workbox file has hash in name, create symlink for current version
for f in dist/workbox-*.js; do ln -sf "$f" "$(basename "$f")" 2>/dev/null; done

echo "Done. Site is live at https://www.spannerwork.co.uk"
