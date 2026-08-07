import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service';
import { AssessmentsService } from '../assessments/assessments.service';

describe('QuizService', () => {
  let service: QuizService;
  let assessmentsService: { getQuestions: jest.Mock };

  beforeEach(async () => {
    assessmentsService = {
      getQuestions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        { provide: AssessmentsService, useValue: assessmentsService },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  describe('getQuestions', () => {
    it('should return an array of questions', async () => {
      assessmentsService.getQuestions.mockResolvedValue([]);
      const questions = await service.getQuestions('en');
      expect(Array.isArray(questions)).toBe(true);
    });

    it('should return questions with correct structure', async () => {
      assessmentsService.getQuestions.mockResolvedValue([
        {
          id: 'q1',
          question_text: 'Test question',
          skill_area: 'speaking',
          category: 'self_assessment',
          options: [
            { id: 'q1_a', text: 'Option A', points: 1 },
            { id: 'q1_d', text: 'Option D', points: 4 },
          ],
        },
      ]);
      const questions = await service.getQuestions('en');
      for (const q of questions) {
        expect(q.id).toBeDefined();
        expect(q.text).toBeDefined();
        expect(q.skill).toBeDefined();
        expect(q.category).toBeDefined();
        expect(q.options.length).toBeGreaterThan(0);
        for (const opt of q.options) {
          expect(opt.id).toBeDefined();
          expect(opt.text).toBeDefined();
          expect(typeof opt.points).toBe('number');
        }
      }
    });

    it('should return questions covering multiple skills', async () => {
      assessmentsService.getQuestions.mockResolvedValue([
        { id: 'q1', question_text: 'Q1', skill_area: 'speaking', category: 'self_assessment', options: [{ id: 'a', text: 'A', points: 1 }] },
        { id: 'q2', question_text: 'Q2', skill_area: 'listening', category: 'comprehension', options: [{ id: 'a', text: 'A', points: 1 }] },
        { id: 'q3', question_text: 'Q3', skill_area: 'reading', category: 'comprehension', options: [{ id: 'a', text: 'A', points: 1 }] },
        { id: 'q4', question_text: 'Q4', skill_area: 'writing', category: 'production', options: [{ id: 'a', text: 'A', points: 1 }] },
        { id: 'q5', question_text: 'Q5', skill_area: 'grammar', category: 'self_assessment', options: [{ id: 'a', text: 'A', points: 1 }] },
        { id: 'q6', question_text: 'Q6', skill_area: 'vocabulary', category: 'self_assessment', options: [{ id: 'a', text: 'A', points: 1 }] },
      ]);
      const questions = await service.getQuestions('en');
      expect(questions.length).toBe(6);
      const skills = new Set(questions.map((q) => q.skill));
      expect(skills.size).toBeGreaterThanOrEqual(4);
    });

    it('should map assessment questions to quiz question format', async () => {
      assessmentsService.getQuestions.mockResolvedValue([
        {
          id: 'q1',
          question_text: 'How well can you introduce yourself?',
          skill_area: 'speaking',
          category: 'self_assessment',
          options: [
            { id: 'q1_a', text: 'Struggle', points: 1 },
            { id: 'q1_d', text: 'Easily', points: 4 },
          ],
        },
      ]);
      const questions = await service.getQuestions('en');
      expect(questions[0].text).toBe('How well can you introduce yourself?');
      expect(questions[0].skill).toBe('speaking');
      expect(questions[0].category).toBe('self_assessment');
    });

    it('should pass language param to assessments service', async () => {
      assessmentsService.getQuestions.mockResolvedValue([]);
      await service.getQuestions('es');
      expect(assessmentsService.getQuestions).toHaveBeenCalledWith('es');
    });

    it('should use en fallback when assessments service throws', async () => {
      assessmentsService.getQuestions.mockRejectedValueOnce(new Error('DB fail'));
      assessmentsService.getQuestions.mockResolvedValueOnce([
        {
          id: 'fb1',
          question_text: 'Fallback Q',
          skill_area: 'listening',
          category: 'comprehension',
          options: [{ id: 'a', text: 'A', points: 1 }],
        },
      ]);
      const questions = await service.getQuestions('es');
      expect(assessmentsService.getQuestions).toHaveBeenCalledTimes(2);
      expect(questions[0].id).toBe('fb1');
    });
  });

  describe('evaluateResults', () => {
    beforeEach(() => {
      assessmentsService.getQuestions.mockResolvedValue([
        { id: 'q1', question_text: 'Q1', skill_area: 'speaking', category: 'self_assessment', options: [
          { id: 'q1_a', text: 'A', points: 1 }, { id: 'q1_d', text: 'D', points: 4 },
        ]},
        { id: 'q2', question_text: 'Q2', skill_area: 'listening', category: 'comprehension', options: [
          { id: 'q2_a', text: 'A', points: 1 }, { id: 'q2_d', text: 'D', points: 4 },
        ]},
      ]);
    });

    it('should compute total score and percentage', async () => {
      const result = await service.evaluateResults('en', { q1: 4, q2: 3 });
      expect(result.totalScore).toBe(7);
      expect(result.maxScore).toBe(8);
      expect(result.percentage).toBe(88);
    });

    it('should return A1 for very low scores', async () => {
      const result = await service.evaluateResults('en', {});
      expect(result.suggestedCefr).toBe('A1');
      expect(result.percentage).toBe(0);
    });

    it('should include a description in the result', async () => {
      const result = await service.evaluateResults('en', { q1: 4, q2: 4 });
      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });

    it('should provide skill breakdown', async () => {
      const result = await service.evaluateResults('en', { q1: 4, q2: 2 });
      expect(result.skillBreakdown).toBeDefined();
      expect(result.skillBreakdown['speaking']).toBeDefined();
      expect(result.skillBreakdown['listening']).toBeDefined();
    });
  });
});
