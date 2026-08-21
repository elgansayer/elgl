// Mock jsdom and dompurify to avoid parsing ESM dependencies (transitively imported through the module)
vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: { createElement: vi.fn(), createDocumentFragment: vi.fn() },
        Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
        NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
      },
    };
  }),
}));
vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: (dirty: string) => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: vi.fn(),
  })),
}));

import { FlashcardsModule } from './flashcards.module';
import { FlashcardsController } from './flashcards.controller';
import { FlashcardsService } from './flashcards.service';
import { SuggestFlashcardsController } from './suggest-flashcards.controller';
import { SuggestFlashcardsService } from './suggest-flashcards.service';
import { XpModule } from '../xp/xp.module';

describe('FlashcardsModule', () => {
  it('should be defined', () => {
    expect(FlashcardsModule).toBeDefined();
  });

  it('should import XpModule', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', FlashcardsModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(XpModule);
  });

  it('should register both controllers', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', FlashcardsModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(FlashcardsController);
    expect(controllersMetadata).toContain(SuggestFlashcardsController);
  });

  it('should register both services in providers', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', FlashcardsModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(FlashcardsService);
    expect(providersMetadata).toContain(SuggestFlashcardsService);
  });

  it('should export both services', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', FlashcardsModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(FlashcardsService);
    expect(exportsMetadata).toContain(SuggestFlashcardsService);
  });
});
