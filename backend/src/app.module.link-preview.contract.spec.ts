import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('AppModule LinkPreviewModule wiring contract', () => {
  const source = readFileSync(join(__dirname, 'app.module.ts'), 'utf8');
  const moduleDecoratorStart = source.indexOf('@Module({');
  const moduleDecorator = source.slice(moduleDecoratorStart);
  const importsStart = moduleDecorator.indexOf('imports: [');
  const controllersStart = moduleDecorator.indexOf('controllers:', importsStart);
  const importsBlock = moduleDecorator.slice(importsStart, controllersStart);

  it('imports LinkPreviewModule from the canonical feature module', () => {
    expect(source).toContain(
      "import { LinkPreviewModule } from './link-preview/link-preview.module';",
    );
  });

  it('registers LinkPreviewModule exactly once in the root imports array', () => {
    expect(moduleDecoratorStart).toBeGreaterThanOrEqual(0);
    expect(importsStart).toBeGreaterThanOrEqual(0);
    expect(controllersStart).toBeGreaterThan(importsStart);
    expect(importsBlock).toMatch(/\bLinkPreviewModule\s*,/);
    expect(importsBlock.match(/\bLinkPreviewModule\b/g) ?? []).toHaveLength(1);
  });
});
