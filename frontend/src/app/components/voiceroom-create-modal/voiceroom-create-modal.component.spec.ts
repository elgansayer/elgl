import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { I18nService } from '../../services/i18n.service';
import { TranslatePipe } from '../../services/translate.pipe';
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from './voiceroom-create-modal.component';
import { signal } from '@angular/core';

describe('VoiceroomCreateModalComponent', () => {
  let component: VoiceroomCreateModalComponent;
  let fixture: ComponentFixture<VoiceroomCreateModalComponent>;

  beforeEach(async () => {
    const i18nMock = {
      translate: (key: string) => key,
      translations: signal({}),
    };

    await TestBed.configureTestingModule({
      imports: [VoiceroomCreateModalComponent, TranslatePipe],
      providers: [
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceroomCreateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default signal values', () => {
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('FreeTalk');
    expect(component.isVideoStream()).toBe(false);
  });

  it('should be invalid with empty title', () => {
    component.title.set('');
    expect(component.isValid()).toBe(false);
  });

  it('should be valid with title, languagePair, and topicTag', () => {
    component.title.set('My Room');
    component.languagePair.set('en-fr');
    component.topicTag.set('FreeTalk');
    expect(component.isValid()).toBe(true);
  });

  it('should emit closed event on closeModal', () => {
    let emitted = false;
    const sub = component.closed.subscribe(() => {
      emitted = true;
    });
    component.closeModal();
    expect(emitted).toBe(true);
    sub.unsubscribe();
  });

  it('should emit created payload on submit when valid', () => {
    let payload: VoiceroomCreatePayload | undefined;
    const sub = component.created.subscribe((p) => {
      payload = p;
    });

    component.title.set('Test Room');
    component.languagePair.set('en-de');
    component.topicTag.set('Beginners');
    component.isVideoStream.set(true);

    component.submit();

    expect(payload).toBeDefined();
    expect(payload!.title).toBe('Test Room');
    expect(payload!.languagePair).toBe('en-de');
    expect(payload!.topicTag).toBe('Beginners');
    expect(payload!.isVideoStream).toBe(true);
    sub.unsubscribe();
  });

  it('should not emit created when submit is called with invalid data', () => {
    let emitted = false;
    const sub = component.created.subscribe(() => {
      emitted = true;
    });

    component.title.set('');
    component.submit();

    expect(emitted).toBe(false);
    sub.unsubscribe();
  });

  it('should render the modal with title and form controls', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('#roomTitle')).toBeTruthy();
    expect(el.querySelector('#langPair')).toBeTruthy();
    expect(el.querySelector('#topicTag')).toBeTruthy();
    expect(el.querySelector('#isVideoStream')).toBeTruthy();
  });

  it('should populate language pair options', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#langPair');
    expect(select).toBeTruthy();
    expect(select.options.length).toBeGreaterThan(0);
  });

  it('should populate topic options', () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('#topicTag');
    expect(select).toBeTruthy();
    expect(select.options.length).toBeGreaterThan(0);
  });

  it('should disable submit button when form is invalid', () => {
    component.title.set('');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const submitBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes('launchStageBtn'),
    ) as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(true);
  });

  it('should enable submit button when form is valid', () => {
    component.title.set('My Room');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const submitBtn = Array.from(buttons).find(
      (b) => b.textContent?.includes('launchStageBtn'),
    ) as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    expect(submitBtn.disabled).toBe(false);
  });

  it('should reset form after closeModal', () => {
    component.title.set('My Room');
    component.languagePair.set('en-fr');
    component.topicTag.set('Pronunciation');
    component.isVideoStream.set(true);

    component.closeModal();

    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('FreeTalk');
    expect(component.isVideoStream()).toBe(false);
  });
});