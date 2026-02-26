/**
 * Post-build script to optimize index.html
 * - Makes CSS non-render-blocking using media="print" trick
 * - Removes unnecessary modulepreloads for chunks not needed on initial load
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distPath = join(__dirname, '../dist/index.html');

// Chunks that should NOT be preloaded (not needed on homepage initial load)
const SKIP_PRELOAD = [
  'vendor-charts',
  'vendor-maps',
  'vendor-animation',
  'vendor-stripe',
  'vendor-socket',
  'vendor-ui',
  'vendor-query',
];

try {
  let html = readFileSync(distPath, 'utf-8');

  // Convert CSS to non-render-blocking using media="print" trick
  // CSP hash 'sha256-1s0LpPfwn9dm7dBgZw4wiCa4VtBx6GosyCDXDna+gbM=' allows this script
  const cssRegex = /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g;
  html = html.replace(cssRegex, (match, cssPath) => {
    return `<link rel="stylesheet" href="${cssPath}" media="print" id="main-css">
<noscript><link rel="stylesheet" href="${cssPath}"></noscript>`;
  });

  // Add inline script to switch CSS media to "all" after load
  // This exact script is whitelisted in CSP via sha256 hash
  const cssLoader = `<script>(function(){var c=document.getElementById('main-css');if(c){c.media='all'}})();</script>`;
  html = html.replace('</body>', cssLoader + '</body>');

  // Remove modulepreload for chunks not needed on initial load
  for (const chunk of SKIP_PRELOAD) {
    const preloadRegex = new RegExp(`\\s*<link rel="modulepreload" crossorigin href="/assets/${chunk}[^"]*\\.js">`, 'g');
    html = html.replace(preloadRegex, '');
  }

  writeFileSync(distPath, html);
  console.log('✅ HTML optimized: CSS non-blocking, unnecessary preloads removed');
} catch (error) {
  console.error('Failed to optimize HTML:', error.message);
  process.exit(1);
}
