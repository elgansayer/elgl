import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service';

describe('QuizService', () => {
  let service: QuizService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QuizService],
    }).compile();

    service = module.get<QuizService>(QuizService);
  });

  describe('getQuestions', () => {
    it('should return an array of questions', () => {
      const questions = service.getQuestions('en');
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
    });

    it('should return questions with correct structure', () => {
      const questions = service.getQuestions('en');
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

    it('should return 10 questions covering multiple skills', () => {
      const questions = service.getQuestions('en');
      expect(questions.length).toBe(10);
      const skills = new Set(questions.map((q) => q.skill));
      expect(skills.size).toBeGreaterThanOrEqual(4);
    });

    it('should ignore the language parameter (mock data)', () => {
      const en = service.getQuestions('en');
      const es = service.getQuestions('es');
      expect(en).toEqual(es);
    });
  });

  describe('evaluateResults', () => {
    it('should compute total score and percentage', () => {
      const result = service.evaluateResults('en', {
        q1: 4,
        q2: 3,
        q3: 2,
        q4: 4,
        q5: 3,
        q6: 4,
        q7: 2,
        q8: 3,
        q9: 1,
        q10: 2,
      });
      expect(result.totalScore).toBe(28);
      expect(result.maxScore).toBe(40);
      expect(result.percentage).toBe(70);
    });

    it('should return A1 for very low scores', () => {
      const result = service.evaluateResults('en', {});
      expect(result.suggestedCefr).toBe('A1');
      expect(result.percentage).toBe(0);
    });

    it('should return A2 for low beginner scores', () => {
      const result = service.evaluateResults('en', {
        q1: 1,
        q2: 1,
        q3: 1,
        q4: 1,
        q5: 1,
        q6: 1,
        q7: 1,
        q8: 1,
        q9: 1,
        q10: 1,
      });
      expect(result.suggestedCefr).toBe('A2');
      expect(result.percentage).toBe(25);
    });

    it('should return C2 for very high scores', () => {
      const result = service.evaluateResults('en', {
        q1: 4,
        q2: 4,
        q3: 4,
        q4: 4,
        q5: 4,
        q6: 4,
        q7: 4,
        q8: 4,
        q9: 4,
        q10: 4,
      });
      expect(result.suggestedCefr).toBe('C2');
      expect(result.percentage).toBeGreaterThanOrEqual(90);
    });

    it('should return B2 for mid-range scores', () => {
      const result = service.evaluateResults('en', {
        q1: 3,
        q2: 3,
        q3: 2,
        q4: 3,
        q5: 2,
        q6: 3,
        q7: 2,
        q8: 3,
        q9: 3,
        q10: 2,
      });
      expect(result.suggestedCefr).toBe('B2');
    });

    it('should handle missing answers', () => {
      const result = service.evaluateResults('en', {
        q1: 4,
        q2: 3,
      });
      expect(result.totalScore).toBe(7);
      expect(result.maxScore).toBe(40);
    });

    it('should provide skill breakdown', () => {
      const result = service.evaluateResults('en', {
        q1: 4,
        q2: 3,
        q3: 2,
        q4: 4,
        q5: 3,
        q6: 2,
        q7: 1,
        q8: 3,
        q9: 4,
        q10: 2,
      });
      expect(result.skillBreakdown).toBeDefined();
      expect(result.skillBreakdown['speaking']).toBeDefined();
      expect(result.skillBreakdown['reading']).toBeDefined();
      expect(result.skillBreakdown['writing']).toBeDefined();
      expect(result.skillBreakdown['listening']).toBeDefined();
      expect(result.skillBreakdown['grammar']).toBeDefined();
      expect(result.skillBreakdown['vocabulary']).toBeDefined();
    });

    it('should include a description in the result', () => {
      const result = service.evaluateResults('en', {
        q1: 4,
        q2: 4,
        q3: 4,
        q4: 4,
        q5: 4,
        q6: 4,
        q7: 4,
        q8: 4,
        q9: 4,
        q10: 4,
      });
      expect(result.description).toBeDefined();
      expect(result.description.length).toBeGreaterThan(0);
    });
  });
});
