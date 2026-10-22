// Local preparation only by default. Building requires an explicit --build.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const api = 'https://team43-api.3-27-96-180.sslip.io';
const cwd = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(cwd, 'node_modules/expo/bin/cli');
const args = process.argv.slice(2);
if (args.some(arg => !['--build'].includes(arg))) {
  throw new Error('Usage: node scripts/private-ios-release.mjs [--build]');
}
console.log('Private iOS release target:', api);
console.log('Requires an approved, deployed compatible backend. This does not verify or deploy AWS.');
if (!args.includes('--build')) {
  console.log('Preparation check only. No build, device install, API request or deployment performed.');
} else {
  if (process.platform !== 'darwin') throw new Error('Native iOS builds must run on your Mac.');
  const env = { ...process.env, EXPO_PUBLIC_API_URL: api, EXPO_NO_DOTENV: '1' };
  // Never inherit an option that would prevent the API URL being bundled.
  delete env.EXPO_NO_CLIENT_ENV_VARS;
  delete env.SKIP_BUNDLING;
  const result = spawnSync(process.execPath,
    [cli, 'run:ios', '--configuration', 'Release', '--device', '--no-bundler'],
    { cwd, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
