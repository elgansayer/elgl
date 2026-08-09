jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: { createElement: jest.fn(), createDocumentFragment: jest.fn() },
      Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_FRAGMENT_NODE: 11 },
      NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    },
  })),
}));

jest.mock('dompurify', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    sanitize: (dirty: string): string => {
      if (typeof dirty !== 'string') return dirty;
      return dirty.replace(/<[^>]*>/g, '');
    },
    setConfig: jest.fn(),
  })),
}));

import { HttpModule } from '@nestjs/axios';
import { EconomyModule } from './economy.module';
import { ChatModule } from '../chat/chat.module';
import { UsersModule } from '../users/users.module';
import { EconomyController } from './economy.controller';
import { EconomyService } from './economy.service';

describe('EconomyModule', () => {
  it('should be defined', () => {
    expect(EconomyModule).toBeDefined();
  });

  it('should import the modules it depends on', () => {
    const importsMetadata =
      (Reflect.getMetadata('imports', EconomyModule) as unknown[]) ?? [];

    expect(importsMetadata).toContain(UsersModule);
    expect(importsMetadata).toContain(ChatModule);
    expect(importsMetadata).toContain(HttpModule);
  });

  it('should register EconomyController in its controllers metadata', () => {
    const controllersMetadata =
      (Reflect.getMetadata('controllers', EconomyModule) as unknown[]) ?? [];

    expect(controllersMetadata).toContain(EconomyController);
  });

  it('should register EconomyService in its providers metadata', () => {
    const providersMetadata =
      (Reflect.getMetadata('providers', EconomyModule) as unknown[]) ?? [];

    expect(providersMetadata).toContain(EconomyService);
  });

  it('should export EconomyService', () => {
    const exportsMetadata =
      (Reflect.getMetadata('exports', EconomyModule) as unknown[]) ?? [];

    expect(exportsMetadata).toContain(EconomyService);
  });
});
