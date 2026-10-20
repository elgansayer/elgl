import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(__dirname, '../src/server.js');
const password = 'supersecretpassword123';

async function findAvailablePort() {
  const socket = createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const address = socket.address();
  assert.ok(address && typeof address === 'object');
  const { port } = address;
  await new Promise((resolve, reject) => {
    socket.close((error) => (error ? reject(error) : resolve()));
  });
  return port;
}

async function waitUntilReady(serverProcess, url, stderr) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`Dashboard exited before becoming ready: ${stderr()}`);
    }
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The child has not bound its socket yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Dashboard did not become ready within 5 seconds: ${stderr()}`);
}

test('server enforces basic auth on protected routes', async () => {
  const port = await findAvailablePort();
  const env = {
    ...process.env,
    PORT: String(port),
    DASHBOARD_USER: 'admin',
    DASHBOARD_PASSWORD: password,
  };
  const serverProcess = spawn('node', [serverPath], {
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  serverProcess.stderr.setEncoding('utf8');
  serverProcess.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    await waitUntilReady(serverProcess, `http://127.0.0.1:${port}/health`, () => stderr);

    const response = await fetch(`http://127.0.0.1:${port}/api/projects`);
    assert.strictEqual(response.status, 401, 'Expected 401 for missing credentials');
    assert.match(response.headers.get('www-authenticate') ?? '', /Basic/);

    const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      headers: { Authorization: `Basic ${Buffer.from('admin:wrong-password').toString('base64')}` },
    });
    assert.strictEqual(invalidResponse.status, 401, 'Expected 401 for invalid credentials');

    const validResponse = await fetch(`http://127.0.0.1:${port}/api/projects`, {
      headers: { Authorization: `Basic ${Buffer.from(`admin:${password}`).toString('base64')}` },
    });
    assert.strictEqual(validResponse.status, 200, 'Expected valid credentials to authorize');
  } finally {
    if (serverProcess.exitCode === null) {
      serverProcess.kill();
      await once(serverProcess, 'exit');
    }
  }
});
