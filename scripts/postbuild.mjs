import fs from 'node:fs';
import path from 'node:path';

const dist = 'dist';

fs.copyFileSync('public/.assetsignore', path.join(dist, '.assetsignore'));

// Overwrite any stale remote `/* /index.html 200` rule. SPA fallback is configured in
// wrangler.toml via not_found_handling = "single-page-application".
fs.writeFileSync(
  path.join(dist, '_redirects'),
  '# SPA routing is handled by wrangler.toml (not_found_handling = single-page-application)\n'
);