import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('Server Authentication integration', async (t) => {
  let child;
  const port = 3199;

  await t.test('setup server', async () => {
    const serverPath = path.join(__dirname, '../src/server.js');
    child = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: port.toString(),
        DASHBOARD_PASSWORD: 'supersecretpassword16chars',
      },
      stdio: 'pipe'
    });

    await new Promise((resolve) => {
        child.stdout.on('data', data => {
            if (data.toString().includes('listening on')) resolve();
        });
        setTimeout(resolve, 5000); // 5s max
    });
  });

  await t.test('protects API routes with Basic Auth and returns 401 Unauthorized', async () => {
    const res = await fetch(`http://localhost:${port}/api/projects`);
    assert.strictEqual(res.status, 401);
  });

  await t.test('allows health check without credentials', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    assert.strictEqual(res.status, 200);
  });

  await t.test('protects static assets with Basic Auth and returns 401', async () => {
    const res = await fetch(`http://localhost:${port}/index.html`);
    assert.strictEqual(res.status, 401);
  });

  await t.test('allows access with correct credentials', async () => {
    const credentials = Buffer.from('admin:supersecretpassword16chars').toString('base64');
    const res = await fetch(`http://localhost:${port}/api/projects`, {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });
    assert.strictEqual(res.status, 200);
  });

  await t.test('rejects access with incorrect credentials', async () => {
    const credentials = Buffer.from('admin:wrongpassword16chars').toString('base64');
    const res = await fetch(`http://localhost:${port}/api/projects`, {
      headers: {
        Authorization: `Basic ${credentials}`
      }
    });
    assert.strictEqual(res.status, 401);
  });

  await t.test('teardown', () => {
    if (child) child.kill();
  });
});
