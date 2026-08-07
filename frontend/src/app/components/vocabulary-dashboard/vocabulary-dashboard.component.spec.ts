import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VocabularyDashboardComponent } from './vocabulary-dashboard.component';
import { I18nService } from '../../services/i18n.service';

describe('VocabularyDashboardComponent', () => {
  let component: VocabularyDashboardComponent;
  let fixture: ComponentFixture<VocabularyDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VocabularyDashboardComponent],
      providers: [
        {
          provide: I18nService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>): string => {
              let text = key;
              if (params) {
                for (const [k, v] of Object.entries(params)) {
                  text = text.split(`{{${k}}}`).join(String(v));
                }
              }
              return text;
            },
          } as unknown as I18nService,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VocabularyDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should flip card on demand', () => {
    expect(component.isFlipped()).toBe(false);
    component.flipCard();
    expect(component.isFlipped()).toBe(true);
  });

  it('should advance to next card after grading good', () => {
    const start = component.currentIndex();
    component.grade('good');
    expect(component.currentIndex()).toBe(start + 1);
  });

  describe('RTL logical CSS properties', () => {
    it('should use logical padding (ps-/pe-) in tab buttons', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).toContain('ps-');
      expect(html).toContain('pe-');
      expect(html).not.toMatch(/\b(pl-\d|pr-\d)\b/);
    });

    it('should not use physical margin utilities (ml-/mr-)', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toMatch(/\b(ml-\d|mr-\d)\b/);
    });

    it('should not contain text-left or text-right classes', () => {
      fixture.detectChanges();
      const html = fixture.nativeElement.innerHTML;
      expect(html).not.toContain('text-left');
      expect(html).not.toContain('text-right');
    });
  });
});
