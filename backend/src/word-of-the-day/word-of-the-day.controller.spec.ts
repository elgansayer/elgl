import { Test, TestingModule } from '@nestjs/testing';
import { WordOfTheDayController } from './word-of-the-day.controller';
import { WordOfTheDayService } from './word-of-the-day.service';

describe('WordOfTheDayController', () => {
  let controller: WordOfTheDayController;
  let service: { getTodayWord: jest.Mock };

  beforeEach(async () => {
    service = {
      getTodayWord: jest.fn().mockReturnValue({
        word: 'Ciao',
        translation: 'Hello / Goodbye',
        language: 'Italian',
        example: 'Ciao, come stai?',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WordOfTheDayController],
      providers: [{ provide: WordOfTheDayService, useValue: service }],
    }).compile();

    controller = module.get<WordOfTheDayController>(WordOfTheDayController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('returns the word of the day from the service', () => {
    const result = controller.findOne();

    expect(service.getTodayWord).toHaveBeenCalled();
    expect(result).toEqual({
      word: 'Ciao',
      translation: 'Hello / Goodbye',
      language: 'Italian',
      example: 'Ciao, come stai?',
    });
  });
});
