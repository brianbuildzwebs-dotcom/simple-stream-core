import { spawnSync } from 'node:child_process';

const wranglerArgs = ['deploy', '--old-asset-ttl', '0'];
const nodeMajor = Number(process.versions.node.split('.')[0] || 0);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: true });
  process.exit(result.status ?? 1);
}

// Workers Builds may still pin Node 20 via dashboard NODE_VERSION.
// Wrangler 4 requires Node 22+, so bootstrap deploy through Node 22 when needed.
if (nodeMajor < 22) {
  console.log(`Detected Node ${process.versions.node}; running Wrangler deploy with Node 22...`);
  run('npx', [
    '-y',
    'node@22',
    './node_modules/wrangler/bin/wrangler.js',
    ...wranglerArgs,
  ]);
}

run('npx', ['wrangler', ...wranglerArgs]);