import type { Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AssessmentsController } from './assessments.controller';
import { AssessmentsService } from './assessments.service';

describe('AssessmentsController', () => {
  let controller: AssessmentsController;
  let service: { getQuestions: Mock };

  beforeEach(async () => {
    service = {
      getQuestions: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssessmentsController],
      providers: [{ provide: AssessmentsService, useValue: service }],
    }).compile();

    controller = module.get<AssessmentsController>(AssessmentsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /assessments/questions', () => {
    it('should return questions with default language', async () => {
      const mockQuestions = [
        {
          id: 'q1',
          question_text: 'Test?',
          language: 'en',
          options: [],
          correct_option_id: 'o1',
          skill_area: 'speaking',
          difficulty_level: 1,
        },
      ];
      service.getQuestions.mockResolvedValue(mockQuestions);

      const result = await controller.getQuestions(
        undefined as unknown as string,
      );
      expect(result).toEqual(mockQuestions);
      expect(service.getQuestions).toHaveBeenCalledWith('en');
    });

    it('should pass language param to service', async () => {
      service.getQuestions.mockResolvedValue([]);

      const result = await controller.getQuestions('es');
      expect(result).toEqual([]);
      expect(service.getQuestions).toHaveBeenCalledWith('es');
    });
  });
});
