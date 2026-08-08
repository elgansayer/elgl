import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['grep', '-n', '-E', '^(<<<<<<<|=======|>>>>>>>)', '--', ':!package-lock.json'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
});

if (result.status === 0 && result.stdout.trim()) {
  process.stderr.write(`Conflict markers found:\n${result.stdout}`);
  process.exitCode = 1;
} else if (result.status !== 1) {
  process.stderr.write(result.stderr || 'Conflict-marker scan failed.\n');
  process.exitCode = result.status ?? 2;
}
