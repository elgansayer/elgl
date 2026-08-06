import { Test, TestingModule } from '@nestjs/testing';
import { CuratedContentController } from './curated-content.controller';
import { CuratedContentService } from './curated-content.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AdminGuard } from '../admin/guards/admin.guard';
import { ExecutionContext } from '@nestjs/common';

describe('CuratedContentController', () => {
  let controller: CuratedContentController;

  const mockService = {
    getArticles: jest.fn(),
    getArticleById: jest.fn(),
    createArticle: jest.fn(),
    getDialogues: jest.fn(),
    getDialogueById: jest.fn(),
    createDialogue: jest.fn(),
  };

  const mockSupabaseAuthGuard = {
    canActivate: jest.fn((context: ExecutionContext) => true),
  };

  const mockAdminGuard = {
    canActivate: jest.fn((context: ExecutionContext) => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CuratedContentController],
      providers: [
        {
          provide: CuratedContentService,
          useValue: mockService,
        },
      ],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue(mockSupabaseAuthGuard)
      .overrideGuard(AdminGuard)
      .useValue(mockAdminGuard)
      .compile();

    controller = module.get<CuratedContentController>(CuratedContentController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should restrict createArticle endpoint', () => {
    const decorators = Reflect.getMetadata('__guards__', controller.createArticle);
    expect(decorators).toBeDefined();
    // In NestJS, guards metadata contains the class references
    expect(decorators).toEqual(expect.arrayContaining([SupabaseAuthGuard, AdminGuard]));
  });

  it('should restrict createDialogue endpoint', () => {
    const decorators = Reflect.getMetadata('__guards__', controller.createDialogue);
    expect(decorators).toBeDefined();
    expect(decorators).toEqual(expect.arrayContaining([SupabaseAuthGuard, AdminGuard]));
  });
});
