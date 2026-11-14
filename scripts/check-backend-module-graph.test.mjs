import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyzeBackendModuleGraph } from './check-backend-module-graph.mjs';

const script = fileURLToPath(new URL('./check-backend-module-graph.mjs', import.meta.url));

function writeTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'backend-graph-'));
  for (const [path, contents] of Object.entries(files)) {
    const target = join(root, path);
    mkdirSync(join(target, '..'), { recursive: true });
    writeFileSync(target, contents);
  }
  return root;
}

const cleanTree = {
  'app.module.ts': `
import { Module } from '@nestjs/common';
import { MountedModule } from './mounted/mounted.module';

@Module({ imports: [MountedModule], controllers: [AppController] })
export class AppModule {}
`,
  'app.controller.ts': `
import { Controller } from '@nestjs/common';

@Controller()
export class AppController {}
`,
  'mounted/mounted.module.ts': `
import { Module } from '@nestjs/common';
import { MountedController } from './mounted.controller';
import { UsedService } from './used.service';

@Module({ controllers: [MountedController], providers: [UsedService] })
export class MountedModule {}
`,
  'mounted/mounted.controller.ts': `
import { Controller } from '@nestjs/common';

@Controller('mounted')
export class MountedController {}
`,
  'mounted/used.service.ts': `
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsedService {}
`,
};

test('accepts a fully connected module graph', () => {
  const root = writeTree(cleanTree);

  assert.deepEqual(analyzeBackendModuleGraph(root), {
    orphanControllers: [],
    orphanModules: [],
    orphanServices: [],
  });

  const result = spawnSync(process.execPath, [script, root], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('reports orphaned controllers, modules and services', () => {
  const root = writeTree({
    ...cleanTree,
    'orphan/orphan.module.ts': `
import { Module } from '@nestjs/common';

@Module({})
export class OrphanModule {}
`,
    'orphan/orphan.controller.ts': `
import { Controller } from '@nestjs/common';

@Controller('orphan')
export class OrphanController {}
`,
    'orphan/orphan.service.ts': `
import { Injectable } from '@nestjs/common';

@Injectable()
export class OrphanService {}
`,
    'orphan/orphan.service.spec.ts': `
import { OrphanService } from './orphan.service';
describe('OrphanService', () => {
  it('imports the service in a spec', () => {
    expect(OrphanService).toBeDefined();
  });
});
`,
  });

  const analysis = analyzeBackendModuleGraph(root);
  assert.deepEqual(analysis.orphanControllers, ['orphan/orphan.controller.ts']);
  assert.deepEqual(analysis.orphanModules, ['orphan/orphan.module.ts']);
  assert.deepEqual(analysis.orphanServices, ['orphan/orphan.service.ts']);

  const result = spawnSync(process.execPath, [script, root], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Controllers not registered by a reachable module/);
  assert.match(result.stderr, /Modules not reachable from AppModule/);
  assert.match(result.stderr, /Services not imported by non-test code/);
});

test('ignores a controller whose file exports a DTO before the decorated class', () => {
  const root = writeTree({
    ...cleanTree,
    'mounted/dto.ts': `export class CreateThingDto {}`,
    'mounted/mounted.controller.ts': `
import { Controller } from '@nestjs/common';
import { CreateThingDto } from './dto';

@Controller('mounted')
export class MountedController {}
`,
  });

  assert.deepEqual(analyzeBackendModuleGraph(root).orphanControllers, []);
});

test('treats an inherited base controller as registered', () => {
  const root = writeTree({
    ...cleanTree,
    'mounted/base.controller.ts': `
import { Controller } from '@nestjs/common';

@Controller('base')
export class BaseController {}
`,
    'mounted/mounted.controller.ts': `
import { Controller } from '@nestjs/common';
import { BaseController } from './base.controller';

@Controller('mounted')
export class MountedController extends BaseController {}
`,
  });

  assert.deepEqual(analyzeBackendModuleGraph(root).orphanControllers, []);
});
