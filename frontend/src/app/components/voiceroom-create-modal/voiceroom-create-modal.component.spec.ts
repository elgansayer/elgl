<<<<<<< HEAD
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
=======
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
>>>>>>> origin/main
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from './voiceroom-create-modal.component';
<<<<<<< HEAD

@Pipe({
  name: 't',
  standalone: true,
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

describe('VoiceroomCreateModalComponent', () => {
  let fixture: ComponentFixture<VoiceroomCreateModalComponent>;
  let component: VoiceroomCreateModalComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [VoiceroomCreateModalComponent],
    });

    TestBed.overrideComponent(VoiceroomCreateModalComponent, {
      set: {
        imports: [FormsModule, MockTranslatePipe],
      },
    });

    fixture = TestBed.createComponent(VoiceroomCreateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
=======
import { I18nService } from '../../services/i18n.service';

describe.skip('VoiceroomCreateModalComponent', () => {
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
    await fixture.whenStable();
>>>>>>> origin/main
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

<<<<<<< HEAD
  it('should render the modal with title, language pair, topic, and video toggle', () => {
    const el: HTMLElement = fixture.nativeElement;

    expect(el.textContent).toContain('audioRoom.modalTitle');
    expect(el.textContent).toContain('audioRoom.roomTitleLabel');
    expect(el.textContent).toContain('audioRoom.languagePairLabel');
    expect(el.textContent).toContain('audioRoom.topicLabel');
    expect(el.textContent).toContain('audioRoom.videoStreamLabel');

    const titleInput = el.querySelector('#roomTitle') as HTMLInputElement;
    expect(titleInput).toBeTruthy();

    const langSelect = el.querySelector('#langPair') as HTMLSelectElement;
    expect(langSelect).toBeTruthy();
    expect(langSelect.options.length).toBe(4);

    const topicSelect = el.querySelector('#topicTag') as HTMLSelectElement;
    expect(topicSelect).toBeTruthy();
    expect(topicSelect.options.length).toBe(6);

    const videoCheckbox = el.querySelector('#isVideoStream') as HTMLInputElement;
    expect(videoCheckbox).toBeTruthy();
    expect(videoCheckbox.type).toBe('checkbox');
  });

  it('should have default values for the form fields', () => {
=======
  it('should initialise with default values', () => {
>>>>>>> origin/main
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
<<<<<<< HEAD
  });

  it('should mark form invalid when title is empty', () => {
    component.title.set('');
    expect(component.isValid()).toBe(false);
  });

  it('should mark form valid when all required fields are set', () => {
    component.title.set('Conversation Practice');
    component.languagePair.set('en-fr');
    component.topicTag.set('Cultural Exchange');
    expect(component.isValid()).toBe(true);
  });

  it('should mark form invalid when title is only whitespace', () => {
    component.title.set('   ');
    component.languagePair.set('en-es');
    component.topicTag.set('Free Talk');
    expect(component.isValid()).toBe(false);
  });

  it('should emit closed event when closeModal is called', () => {
    let emitted = false;
    component.closed.subscribe(() => {
      emitted = true;
    });

    component.closeModal();
    expect(emitted).toBe(true);
  });

  it('should reset form after closeModal', () => {
    component.title.set('My Room');
    component.languagePair.set('en-ja');
=======
    expect(component.isValid()).toBe(false);
  });

  it('should make isValid true when title is filled and selections set', () => {
    expect(component.isValid()).toBe(false);
    component.title.set('My Room');
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

    component.title.set('My Room');
    component.languagePair.set('en-fr');
>>>>>>> origin/main
    component.topicTag.set('Beginners');
    component.isVideoStream.set(true);

    component.closeModal();

<<<<<<< HEAD
=======
    expect(closedSpy).toHaveBeenCalledTimes(1);
>>>>>>> origin/main
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
<<<<<<< HEAD
  });

  it('should emit created event with correct payload on submit', () => {
    let payload: VoiceroomCreatePayload | null = null;
    component.created.subscribe((p) => {
      payload = p;
    });

    component.title.set('My Spanish Room');
    component.languagePair.set('en-es');
    component.topicTag.set('Pronunciation');
    component.isVideoStream.set(true);

    component.submit();

    expect(payload).toEqual({
      title: 'My Spanish Room',
      languagePair: 'en-es',
      topicTag: 'Pronunciation',
      isVideoStream: true,
    });
  });

  it('should trim title whitespace in emitted payload', () => {
    let payload: VoiceroomCreatePayload | null = null;
    component.created.subscribe((p) => {
      payload = p;
    });

    component.title.set('  Clean Room  ');
    component.languagePair.set('en-es');
    component.topicTag.set('Free Talk');

    component.submit();

    expect(payload!.title).toBe('Clean Room');
  });

  it('should not emit created event when form is invalid', () => {
    let emitted = false;
    component.created.subscribe(() => {
      emitted = true;
    });
=======
    sub.unsubscribe();
  });

  it('should emit created with correct payload and close on submit', () => {
    let emitted: VoiceroomCreatePayload | undefined;
    const createdSub = component.created.subscribe((p) => (emitted = p));
    const closedSpy = vi.fn();
    const closedSub = component.closed.subscribe(closedSpy);

    component.title.set('  Conversation Club  ');
    component.languagePair.set('ja-en');
    component.topicTag.set('Grammar Help');
    component.isVideoStream.set(true);

    component.submit();
    fixture.detectChanges();

    expect(emitted).toEqual({
      title: 'Conversation Club',
      languagePair: 'ja-en',
      topicTag: 'Grammar Help',
      isVideoStream: true,
    });
    expect(closedSpy).toHaveBeenCalledTimes(1);

    createdSub.unsubscribe();
    closedSub.unsubscribe();
  });

  it('should not emit when submit is called with invalid form', () => {
    const createdSpy = vi.fn();
    const sub = component.created.subscribe(createdSpy);
>>>>>>> origin/main

    component.title.set('');
    component.submit();

<<<<<<< HEAD
    expect(emitted).toBe(false);
  });

  it('should also emit closed event when submit succeeds', () => {
    let closeEmitted = false;
    component.closed.subscribe(() => {
      closeEmitted = true;
    });

    component.title.set('Room');
    component.languagePair.set('en-es');
    component.topicTag.set('Free Talk');

    component.submit();

    expect(closeEmitted).toBe(true);
  });

  it('should render launch button disabled when form is invalid', () => {
    component.title.set('');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const launchBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(launchBtn.textContent).toContain('audioRoom.launchStageBtn');
    expect(launchBtn.disabled).toBe(true);
  });

  it('should render launch button enabled when form is valid', () => {
    component.title.set('Valid Title');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    const launchBtn = buttons[buttons.length - 1] as HTMLButtonElement;
    expect(launchBtn.textContent).toContain('audioRoom.launchStageBtn');
    expect(launchBtn.disabled).toBe(false);
=======
    expect(createdSpy).not.toHaveBeenCalled();
    sub.unsubscribe();
  });

  it('should expose 23 language pair options', () => {
    expect(component.LANGUAGE_PAIR_OPTIONS).toHaveLength(23);
    const first = component.LANGUAGE_PAIR_OPTIONS[0];
    expect(first.value).toBe('en-es');
    expect(first.labelKey).toBe('audioRoom.languagePair.en-es');
  });

  it('should expose 6 topic options', () => {
    expect(component.TOPIC_OPTIONS).toHaveLength(6);
    expect(component.TOPIC_OPTIONS[0].value).toBe('Pronunciation');
    expect(component.TOPIC_OPTIONS[5].value).toBe('Business English');
  });

  it('should render modal title from translation', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h2')?.textContent).toContain('audioRoom.modalTitle');
  });

  it('should disable the launch button when form is invalid', () => {
    const el: HTMLElement = fixture.nativeElement;
    const submitBtn = el.querySelectorAll('button')[2] as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    component.title.set('My Room');
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(false);
  });

  it('should call closeModal when close button is clicked', () => {
    const closeSpy = vi.spyOn(component, 'closeModal');
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const closeBtn = buttons[0]; // first button = close X
    closeBtn.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should call submit when launch button is clicked', () => {
    const submitSpy = vi.spyOn(component, 'submit');
    component.title.set('Test');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const buttons = el.querySelectorAll('button');
    const launchBtn = buttons[2]; // third button = launch
    launchBtn.click();
    expect(submitSpy).toHaveBeenCalledTimes(1);
>>>>>>> origin/main
  });
});