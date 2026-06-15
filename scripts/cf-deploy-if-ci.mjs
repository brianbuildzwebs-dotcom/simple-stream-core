import { spawnSync } from 'node:child_process';

// Cloudflare Workers Builds runs `wrangler deploy` as its own deploy step.
if (process.env.WORKERS_CI === '1') {
  process.exit(0);
}

const isCi =
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  process.env.CF_PAGES === '1';

if (!isCi) {
  process.exit(0);
}

const result = spawnSync(
  'npx',
  ['wrangler', 'deploy', '--old-asset-ttl', '0'],
  { stdio: 'inherit', shell: true }
);

process.exit(result.status ?? 1);