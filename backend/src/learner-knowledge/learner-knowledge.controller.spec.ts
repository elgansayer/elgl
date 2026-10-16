import { Test, TestingModule } from '@nestjs/testing';
import { LearnerKnowledgeController } from './learner-knowledge.controller';
import { LearnerKnowledgeService } from './learner-knowledge.service';
import { CEFRLevel, LearnerKnowledgeProfile } from './learner-knowledge.service';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { ExecutionContext } from '@nestjs/common';

describe('LearnerKnowledgeController', () => {
  let controller: LearnerKnowledgeController;
  let service: LearnerKnowledgeService;

  const mockProfile: LearnerKnowledgeProfile = {
    userId: 'user123',
    language: 'en',
    overallProficiency: { level: 'B1' },
    skills: {
      speaking: 0.5,
      listening: 0.6,
      reading: 0.7,
      writing: 0.4,
      grammar: 0.5,
      vocabulary: 0.6,
    },
    knowledgeItems: new Map(),
    recentEncounters: [],
  };

  const mockLearnerKnowledgeService = {
    getProfile: vi.fn().mockResolvedValue(mockProfile),
  };

  const mockSupabaseAuthGuard = {
    canActivate: vi.fn((context: ExecutionContext) => true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LearnerKnowledgeController],
      providers: [
        {
          provide: LearnerKnowledgeService,
          useValue: mockLearnerKnowledgeService,
        },
      ],
    })
    .overrideGuard(SupabaseAuthGuard)
    .useValue(mockSupabaseAuthGuard)
    .compile();

    controller = module.get<LearnerKnowledgeController>(LearnerKnowledgeController);
    service = module.get<LearnerKnowledgeService>(LearnerKnowledgeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProfile', () => {
    it('should return a learner knowledge profile', async () => {
      const req = { user: { id: 'user123' } };
      const language = 'en';

      const result = await controller.getProfile(req, language);

      expect(service.getProfile).toHaveBeenCalledWith('user123', 'en');
      expect(result).toEqual(mockProfile);
    });
  });
});
