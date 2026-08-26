import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../services/i18n.service';
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from './voiceroom-create-modal.component';

describe('VoiceroomCreateModalComponent', () => {
  let component: VoiceroomCreateModalComponent;
  let fixture: ComponentFixture<VoiceroomCreateModalComponent>;
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
      imports: [VoiceroomCreateModalComponent],
      providers: [{ provide: I18nService, useValue: i18nServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceroomCreateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('initialises with safe defaults', () => {
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
    expect(component.isValid()).toBe(false);
  });

  it('requires a non-empty trimmed title', () => {
    component.title.set('   ');
    expect(component.isValid()).toBe(false);

    component.title.set('Conversation Club');
    expect(component.isValid()).toBe(true);
  });

  it('requires both language pair and topic selections', () => {
    component.title.set('Conversation Club');
    component.languagePair.set('');
    expect(component.isValid()).toBe(false);

    component.languagePair.set('ja-en');
    component.topicTag.set('');
    expect(component.isValid()).toBe(false);
  });

  it('emits a trimmed, typed creation payload without closing prematurely', () => {
    let emitted: VoiceroomCreatePayload | undefined;
    const closedSpy = vi.fn();
    const createdSub = component.created.subscribe((payload) => (emitted = payload));
    const closedSub = component.closed.subscribe(closedSpy);

    component.title.set('  Conversation Club  ');
    component.languagePair.set('ja-en');
    component.topicTag.set('Grammar Help');
    component.isVideoStream.set(true);

    component.submit();

    expect(emitted).toEqual({
      title: 'Conversation Club',
      languagePair: 'ja-en',
      topicTag: 'Grammar Help',
      isVideoStream: true,
    });
    expect(closedSpy).not.toHaveBeenCalled();
    expect(component.title()).toBe('  Conversation Club  ');

    createdSub.unsubscribe();
    closedSub.unsubscribe();
  });

  it('does not emit an invalid creation request', () => {
    const createdSpy = vi.fn();
    const sub = component.created.subscribe(createdSpy);

    component.submit();

    expect(createdSpy).not.toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('resets the draft only when the modal is explicitly closed', () => {
    const closedSpy = vi.fn();
    const sub = component.closed.subscribe(closedSpy);

    component.title.set('My Room');
    component.languagePair.set('en-fr');
    component.topicTag.set('Beginners');
    component.isVideoStream.set(true);

    component.closeModal();

    expect(closedSpy).toHaveBeenCalledTimes(1);
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
    sub.unsubscribe();
  });

  it('exposes the supported language pairs and topics', () => {
    expect(component.LANGUAGE_PAIR_OPTIONS).toHaveLength(23);
    expect(component.LANGUAGE_PAIR_OPTIONS[0]).toEqual({
      value: 'en-es',
      labelKey: 'audioRoom.languagePair.en-es',
    });
    expect(component.TOPIC_OPTIONS).toHaveLength(6);
    expect(component.TOPIC_OPTIONS[0].value).toBe('Pronunciation');
    expect(component.TOPIC_OPTIONS[5].value).toBe('Business English');
  });

  it('renders translated labels and disables Launch until the form is valid', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('audioRoom.modalTitle');
    expect(root.textContent).toContain('audioRoom.roomTitleLabel');
    expect(root.textContent).toContain('audioRoom.languagePairLabel');
    expect(root.textContent).toContain('audioRoom.topicLabel');

    const launchButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('audioRoom.launchStageBtn'),
    );
    expect(launchButton).toBeTruthy();
    expect(launchButton?.disabled).toBe(true);

    component.title.set('My Room');
    fixture.detectChanges();
    expect(launchButton?.disabled).toBe(false);
  });

  it('does not close or reset the draft when Launch is clicked', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const createdSpy = vi.fn();
    const closedSpy = vi.fn();
    const createdSub = component.created.subscribe(createdSpy);
    const closedSub = component.closed.subscribe(closedSpy);

    component.title.set('Retryable Room');
    fixture.detectChanges();

    const launchButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('audioRoom.launchStageBtn'),
    );
    expect(launchButton).toBeTruthy();

    launchButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(createdSpy).toHaveBeenCalledWith({
      title: 'Retryable Room',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      isVideoStream: false,
    });
    expect(closedSpy).not.toHaveBeenCalled();
    expect(component.title()).toBe('Retryable Room');

    createdSub.unsubscribe();
    closedSub.unsubscribe();
  });
  it('blocks duplicate Launch requests while creation is in progress', () => {
    const root = fixture.nativeElement as HTMLElement;
    const createdSpy = vi.fn();
    const sub = component.created.subscribe(createdSpy);

    component.title.set('Only One Room');
    fixture.componentRef.setInput('isSubmitting', true);
    fixture.detectChanges();

    const launchButton = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('audioRoom.launchStageBtn'),
    );
    expect(launchButton).toBeTruthy();
    expect(launchButton?.disabled).toBe(true);
    expect(launchButton?.getAttribute('aria-busy')).toBe('true');

    component.submit();
    launchButton?.click();

    expect(createdSpy).not.toHaveBeenCalled();
    sub.unsubscribe();
  });
});
