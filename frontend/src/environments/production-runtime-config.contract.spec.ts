import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const frontendRoot = resolve(process.cwd());
const productionEnvironment = readFileSync(
  resolve(frontendRoot, 'src/environments/environment.prod.ts'),
  'utf8',
);
const angularConfig = readFileSync(resolve(frontendRoot, 'angular.json'), 'utf8');
const dockerfile = readFileSync(resolve(frontendRoot, 'Dockerfile'), 'utf8');
const index = readFileSync(resolve(frontendRoot, 'src/index.html'), 'utf8');
const entrypoint = readFileSync(
  resolve(frontendRoot, 'docker-entrypoint.d/40-runtime-config.sh'),
  'utf8',
);
const runtimeTemplate = readFileSync(
  resolve(frontendRoot, 'runtime-config.js.template'),
  'utf8',
);
const activeWorkflowPath = resolve(
  frontendRoot,
  '../.github/workflows/frontend-container-ci.yml',
);
const containerWorkflow = readFileSync(
  existsSync(activeWorkflowPath)
    ? activeWorkflowPath
    : resolve(
        frontendRoot,
        '../.github/workflows-disabled/frontend-container-ci.yml',
      ),
  'utf8',
);
const composeFiles = ['../docker-compose.yml', '../docker-compose.prod.yml'].map(
  (path) => readFileSync(resolve(frontendRoot, path), 'utf8'),
);

describe('production runtime configuration', () => {
  it('replaces the development environment in production builds', () => {
    expect(angularConfig).toContain('"with": "src/environments/environment.prod.ts"');
  });

  it('replaces the mock environment in development builds', () => {
    expect(angularConfig).toContain(
      '"with": "src/environments/environment.development.ts"',
    );
  });

  it('passes deployment configuration to the web container in both compose stacks', () => {
    for (const compose of composeFiles) {
      for (const variable of [
        'PUBLIC_SUPABASE_URL',
        'PUBLIC_SUPABASE_ANON_KEY',
        'PUBLIC_CENTRIFUGO_URL',
        'PUBLIC_LIVEKIT_URL',
      ]) {
        expect(compose).toContain(`- ${variable}=`);
      }
    }
  });

  it('contains no development service origins or credential placeholders', () => {
    expect(productionEnvironment).not.toMatch(/mock\.supabase|127\.0\.0\.1|localhost/i);
    expect(productionEnvironment).not.toMatch(/YOUR_[A-Z_]+|somepassword/i);
  });

  it('loads and validates deployment-provided configuration before Angular', () => {
    expect(index).toContain('<script src="runtime-config.js"></script>');
    expect(productionEnvironment).toMatch(
      /get supabaseUrl\(\): string \{[\s\S]*loadRuntimeConfig\(globalThis\.__HELLOTALK_CONFIG__\)/,
    );
    expect(productionEnvironment).not.toMatch(
      /const runtime = loadRuntimeConfig\(globalThis\.__HELLOTALK_CONFIG__\)/,
    );
  });

  it('renders runtime configuration during container startup', () => {
    expect(dockerfile).toContain('docker-entrypoint.d/40-runtime-config.sh');
    expect(dockerfile).toContain('runtime-config.js.template');
    expect(entrypoint).toContain('Missing required production variable');
    expect(entrypoint).toContain('PUBLIC_SUPABASE_URL');
    expect(entrypoint).toContain('PUBLIC_CENTRIFUGO_URL');
    expect(entrypoint).toContain('PUBLIC_LIVEKIT_URL');
  });

  it('provides runtime configuration when CI starts the production container', () => {
    expect(containerWorkflow).toContain('-e PUBLIC_SUPABASE_URL=');
    expect(containerWorkflow).toContain('-e PUBLIC_SUPABASE_ANON_KEY=');
    expect(containerWorkflow).toContain('-e PUBLIC_CENTRIFUGO_URL=');
    expect(containerWorkflow).toContain('-e PUBLIC_LIVEKIT_URL=');
    expect(containerWorkflow).toContain('docker run --rm --entrypoint sh');
  });

  it('never renders persistent TURN credentials into the browser bundle', () => {
    expect(runtimeTemplate).not.toMatch(/TURN|turnPassword|turnUsername/i);
    expect(productionEnvironment).not.toMatch(/turnPassword|turnUsername/i);
  });
});
