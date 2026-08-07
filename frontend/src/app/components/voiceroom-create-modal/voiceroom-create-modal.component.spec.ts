import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  VoiceroomCreateModalComponent,
  VoiceroomCreatePayload,
} from './voiceroom-create-modal.component';

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
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

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
    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
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
    component.topicTag.set('Beginners');
    component.isVideoStream.set(true);

    component.closeModal();

    expect(component.title()).toBe('');
    expect(component.languagePair()).toBe('en-es');
    expect(component.topicTag()).toBe('Free Talk');
    expect(component.isVideoStream()).toBe(false);
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

    component.title.set('');
    component.submit();

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
  });
});