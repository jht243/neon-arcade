#!/usr/bin/env node
/**
 * Inline the compiled JS bundle into the HTML template using base64 encoding
 * to avoid HTML parser issues with large bundles.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.join(__dirname, '../assets/neon-arcade.html');
const jsPath = path.join(__dirname, '../assets/neon-arcade.js');

console.log('[Inline Bundle] Reading files...');
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
const jsContent = fs.readFileSync(jsPath, 'utf-8');

console.log(`[Inline Bundle] JS bundle size: ${(jsContent.length / 1024).toFixed(2)} KB`);

const encodedJS = Buffer.from(jsContent, 'utf-8').toString('base64');
console.log(`[Inline Bundle] Encoded size: ${(encodedJS.length / 1024).toFixed(2)} KB`);

const inlineScript = `<script type="module">
  const encodedScript = ${JSON.stringify(encodedJS)};
  const decodedScript = atob(encodedScript);
  const blob = new Blob([decodedScript], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  import(url)
    .catch(err => {
      console.error('[Neon Arcade] Failed to load:', err);
      const root = document.getElementById('arcade-root');
      if (root) {
        root.innerHTML = '<div style="padding:24px;text-align:center;color:#f87171;">Failed to load game. Please refresh.</div>';
      }
    });
</script>
</body>`;

const updatedHtml = htmlContent.replace(
  /<script[^>]*>[\s\S]*?<\/script>\s*<\/body>/,
  inlineScript
);

const hasScriptTag = /<script[^>]*>[\s\S]*?<\/script>\s*<\/body>/.test(htmlContent);

if (!hasScriptTag) {
  console.error('[Inline Bundle] ERROR: No <script>...</script></body> block found in HTML!');
  process.exit(1);
}

if (updatedHtml === htmlContent) {
  console.log('[Inline Bundle] Bundle already up to date — nothing changed');
} else {
  fs.writeFileSync(htmlPath, updatedHtml, 'utf-8');
  console.log('[Inline Bundle] Successfully inlined encoded bundle into HTML');
}
console.log(`[Inline Bundle] Output: ${htmlPath}`);
