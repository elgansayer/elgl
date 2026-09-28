import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  LanguagePartyCreateModalComponent,
  LanguagePartyCreatePayload,
} from './language-party-create-modal.component';
import { I18nService } from '../../services/i18n.service';

describe('LanguagePartyCreateModalComponent', () => {
  let component: LanguagePartyCreateModalComponent;
  let fixture: ComponentFixture<LanguagePartyCreateModalComponent>;
  let i18nServiceMock: Partial<I18nService>;

  beforeEach(async () => {
    i18nServiceMock = {
      currentLang: signal('en-GB'),
      availableLanguages: [],
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (params) return `${key}(${JSON.stringify(params)})`;
        return key;
      }),
      setLanguage: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LanguagePartyCreateModalComponent],
      providers: [{ provide: I18nService, useValue: i18nServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguagePartyCreateModalComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise with default values', () => {
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.level()).toBe('all');
    expect(component.isVideoStream()).toBe(false);
    expect(component.isValid()).toBe(false);
  });

  it('should make isValid true when title is filled', () => {
    expect(component.isValid()).toBe(false);
    component.title.set('My Language Party');
    fixture.detectChanges();
    expect(component.isValid()).toBe(true);
  });

  it('should make isValid false when title is only whitespace', () => {
    component.title.set('   ');
    fixture.detectChanges();
    expect(component.isValid()).toBe(false);
  });

  it('should emit closed and reset form on closeModal', () => {
    const closedSpy = vi.fn();
    const sub = component.closed.subscribe(closedSpy);

    component.title.set('My Party');
    component.languagePair.set('en-fr');
    component.topicTag.set('Beginners');
    component.level.set('intermediate');
    component.isVideoStream.set(true);

    component.closeModal();

    expect(closedSpy).toHaveBeenCalledTimes(1);
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.level()).toBe('all');
    expect(component.isVideoStream()).toBe(false);
    sub.unsubscribe();
  });

  it('should emit created with correct payload and close on submit', () => {
    let emitted: LanguagePartyCreatePayload | undefined;
    const createdSub = component.created.subscribe((p) => (emitted = p));
    const closedSpy = vi.fn();
    const closedSub = component.closed.subscribe(closedSpy);

    component.title.set('  Conversation Club  ');
    component.languagePair.set('ja-en');
    component.topicTag.set('Grammar Help');
    component.level.set('advanced');
    component.isVideoStream.set(true);

    component.submit();
    fixture.detectChanges();

    expect(emitted).toEqual({
      title: 'Conversation Club',
      languagePair: 'ja-en',
      topicTag: 'Grammar Help',
      level: 'advanced',
      isVideoStream: true,
    });
    expect(closedSpy).toHaveBeenCalledTimes(1);

    createdSub.unsubscribe();
    closedSub.unsubscribe();
  });

  it('should not emit when submit is called with invalid form', () => {
    const createdSpy = vi.fn();
    const sub = component.created.subscribe(createdSpy);

    component.title.set('');
    component.submit();

    expect(createdSpy).not.toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('should expose 23 language pair options', () => {
    expect(component.LANGUAGE_PAIR_OPTIONS).toHaveLength(23);
    const first = component.LANGUAGE_PAIR_OPTIONS[0];
    expect(first.value).toBe('en-es');
    expect(first.labelKey).toBe('audioRoom.languagePair.en-es');
  });

  it('should expose 9 topic options', () => {
    expect(component.TOPIC_OPTIONS).toHaveLength(9);
    expect(component.TOPIC_OPTIONS[0].value).toBe('Free Talk');
  });

  it('should expose 4 level options', () => {
    expect(component.LEVEL_OPTIONS).toHaveLength(4);
    expect(component.LEVEL_OPTIONS[0].value).toBe('beginner');
    expect(component.LEVEL_OPTIONS[3].value).toBe('all');
  });

  it('should render modal title from translation', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain('languageParty.modalTitle');
  });

  it('should disable the launch button when form is invalid', () => {
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const submitBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    component.title.set('My Party');
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(false);
  });

  it('should call closeModal when close button is clicked', () => {
    const closeSpy = vi.spyOn(component, 'closeModal');
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const closeBtn = buttons[0];
    closeBtn.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should call submit when launch button is clicked', () => {
    const submitSpy = vi.spyOn(component, 'submit');
    component.title.set('Test');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const launchBtn = buttons[buttons.length - 1];
    launchBtn.click();
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });

  it('should close modal on overlay click', () => {
    const closeSpy = vi.spyOn(component, 'closeModal');
    const el: HTMLElement = fixture.nativeElement;
    const overlay = el.querySelector('.fixed.inset-0') as HTMLElement;
    if (overlay) {
      overlay.click();
      expect(closeSpy).toHaveBeenCalled();
    }
  });
});
