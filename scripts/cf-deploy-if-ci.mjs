import { spawnSync } from 'node:child_process';

const isCi =
  process.env.WORKERS_CI === '1' ||
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