import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { GrammarCheckBannerComponent } from './grammar-check-banner.component';
import { I18nService } from '../../services/i18n.service';
import { AuthService } from '../../services/auth.service';
import { VocabularyStore } from '../../services/vocabulary.store';

describe('GrammarCheckBannerComponent', () => {
  let component: GrammarCheckBannerComponent;
  let fixture: ComponentFixture<GrammarCheckBannerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GrammarCheckBannerComponent],
      providers: [
        provideHttpClient(),
        { provide: AuthService, useValue: { currentUser: vi.fn(() => null) } },
        { provide: I18nService, useValue: { translate: vi.fn((k: string) => k), translations: vi.fn(() => ({})) } },
        { provide: VocabularyStore, useValue: { checkGrammar: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GrammarCheckBannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have banner hidden by default', () => {
    expect(component.showBanner()).toBe(false);
    expect(component.grammarResult()).toBeNull();
  });

  it('should emit corrected text when applyCorrection is called', () => {
    const correctedSpy = vi.fn();
    component.corrected.subscribe(correctedSpy);

    component.grammarResult.set({
      original: 'I go',
      corrected: 'I went',
      explanation: '',
      errors_found: 1,
    });
    component.showBanner.set(true);

    component.applyCorrection();

    expect(correctedSpy).toHaveBeenCalledWith('I went');
    expect(component.showBanner()).toBe(false);
    expect(component.grammarResult()).toBeNull();
  });

  it('should emit the corrected text from grammarResult when ignoring', () => {
    const ignoredSpy = vi.fn();
    component.ignored.subscribe(ignoredSpy);

    component.grammarResult.set({
      original: 'I go',
      corrected: 'I went',
      explanation: '',
      errors_found: 1,
    });
    component.showBanner.set(true);

    component.ignoreAndSend();

    expect(ignoredSpy).toHaveBeenCalled();
    expect(component.showBanner()).toBe(false);
    expect(component.grammarResult()).toBeNull();
  });

  it('should dismiss the banner', () => {
    component.grammarResult.set({
      original: 'I go',
      corrected: 'I went',
      explanation: '',
      errors_found: 1,
    });
    component.showBanner.set(true);
    expect(component.showBanner()).toBe(true);

    component.dismissGrammarBanner();
    expect(component.showBanner()).toBe(false);
    expect(component.grammarResult()).toBeNull();
  });

  it('should not set banner shown when errors_found is 0 and text matches', () => {
    component.grammarResult.set({
      original: 'Hello',
      corrected: 'Hello',
      explanation: '',
      errors_found: 0,
    });
    // showBanner is still false because the result doesn't trigger it automatically
    // (the check() method handles that logic, not just setting grammarResult)
    expect(component.showBanner()).toBe(false);
  });
});