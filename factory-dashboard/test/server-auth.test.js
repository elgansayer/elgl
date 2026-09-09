import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '../src/server.js');

test('server enforces basic auth on protected routes', async () => {
  const port = 3105;
  const env = {
    ...process.env,
    PORT: port.toString(),
    DASHBOARD_USER: 'admin',
    DASHBOARD_PASSWORD: 'supersecretpassword123',
  };

  const serverProcess = spawn('node', [serverPath], { env });

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const response = await fetch(`http://localhost:${port}/api/projects`);
    assert.strictEqual(response.status, 401, 'Expected 401 Unauthorized for missing auth');

    const authHeader = response.headers.get('www-authenticate');
    assert.ok(authHeader && authHeader.includes('Basic'), 'Expected WWW-Authenticate header');

    const healthResponse = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(healthResponse.status, 200, 'Expected 200 OK for /health');

  } finally {
    serverProcess.kill();
  }
});
