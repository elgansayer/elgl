import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { I18nService } from './i18n.service';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TranslatePipe,
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) => {
              if (key === 'app.title') return 'HelloTalk';
              if (key === 'common.coinsBalance' && params) return `${params['coins']} Coins`;
              return key;
            },
          },
        },
      ],
    });
    pipe = TestBed.inject(TranslatePipe);
  });

  it('create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should transform key using I18nService', () => {
    const result = pipe.transform('app.title');
    expect(result).toBe('HelloTalk');
  });

  it('should pass parameters correctly to I18nService', () => {
    const result = pipe.transform('common.coinsBalance', { coins: 50 });
    expect(result).toBe('50 Coins');
  });
});
