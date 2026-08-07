import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { VoiceroomNotesComponent } from './voiceroom-notes.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';
<<<<<<< HEAD
import { TranslatePipe } from '../../services/translate.pipe';
=======

@Pipe({
  name: 't',
  standalone: true,
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}
>>>>>>> origin/main

class MockI18nService {
  currentLang = signal('en-GB');
  translate(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

<<<<<<< HEAD
class MockCentrifugeService {
  subscribe = vi.fn();
  unsubscribe = vi.fn();
}
=======
class MockCentrifugoService {
  subscribeLiveRoom = jest.fn();
  unsubscribeLiveRoom = jest.fn();
  publish = jest.fn();
}

@Component({
  template: `<app-voiceroom-notes [roomId]="'room-1'" />`,
  imports: [VoiceroomNotesComponent],
})
class HostComponent {}
>>>>>>> origin/main

describe('VoiceroomNotesComponent', () => {
  let fixture: ComponentFixture<VoiceroomNotesComponent>;
  let component: VoiceroomNotesComponent;
  let httpMock: HttpTestingController;
  let mockCentrifuge: MockCentrifugeService;

  beforeEach(async () => {
    mockCentrifuge = new MockCentrifugeService();

    await TestBed.configureTestingModule({
      imports: [VoiceroomNotesComponent, TranslatePipe],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useClass: MockI18nService },
<<<<<<< HEAD
        { provide: CentrifugoService, useValue: mockCentrifuge },
=======
        { provide: CentrifugoService, useClass: MockCentrifugoService },
>>>>>>> origin/main
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VoiceroomNotesComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('roomId', 'room-1');
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should load notes from the backend on init', async () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/audio-rooms/room-1/notes');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'n1',
        room_id: 'room-1',
        author_id: 'u1',
        author_name: 'Alice',
        content: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.notesResource.value()).toHaveLength(1);
    expect(component.notesResource.value()![0].author_name).toBe('Alice');
    expect(fixture.nativeElement.textContent).toContain('Alice');
  });

  it('should subscribe to centrifugo on init', () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);

    expect(mockCentrifuge.subscribe).toHaveBeenCalledWith('room_room-1', expect.any(Function));
  });

  it('should refresh notes when centrifugo broadcasts a voice_room_note event', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const subscribeCalls = mockCentrifuge.subscribe.mock.calls;
    expect(subscribeCalls.length).toBeGreaterThan(0);
    const callback = subscribeCalls[subscribeCalls.length - 1][1] as (data: unknown) => void;
    callback({ type: 'voice_room_note', note: { id: 'n1' } });

    const reloadReq = httpMock.expectOne('/audio-rooms/room-1/notes');
    reloadReq.flush([
      {
        id: 'n1',
        room_id: 'room-1',
        author_id: 'u1',
        author_name: 'Alice',
        content: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.notesResource.value()).toHaveLength(1);
  });

  it('should not reload on non voice_room_note events', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    const subscribeCalls = mockCentrifuge.subscribe.mock.calls;
    const callback = subscribeCalls[subscribeCalls.length - 1][1] as (data: unknown) => void;
    callback({ type: 'other_event' });

    httpMock.expectNone('/audio-rooms/room-1/notes');
  });

  it('should create a note and then reload the list', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    component.content.set('New note');
    component.vocabulary.set('word');
    component.addNote();

    const postReq = httpMock.expectOne('/audio-rooms/room-1/notes');
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ content: 'New note', vocabulary: 'word' });
    postReq.flush({});

    const reloadReq = httpMock.expectOne('/audio-rooms/room-1/notes');
    expect(reloadReq.request.method).toBe('GET');
    reloadReq.flush([
      {
        id: 'n2',
        room_id: 'room-1',
        author_id: 'u2',
        author_name: 'Bob',
        content: 'Second',
        created_at: '2026-01-02T00:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.content()).toBe('');
    expect(component.vocabulary()).toBe('');
    expect(component.notesResource.value()).toHaveLength(1);
  });

  it('should delete a note and reload the list', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([
      {
        id: 'n1',
        room_id: 'room-1',
        author_id: 'u1',
        author_name: 'Alice',
        content: 'Hello',
        created_at: '2026-01-01T00:00:00Z',
      },
    ]);
    await fixture.whenStable();
    fixture.detectChanges();

    component.deleteNote('n1');

    const deleteReq = httpMock.expectOne('/audio-rooms/room-1/notes/n1');
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush({});
    await fixture.whenStable();
    fixture.detectChanges();

    const reloadReq = httpMock.expectOne('/audio-rooms/room-1/notes');
    expect(reloadReq.request.method).toBe('GET');
    reloadReq.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.notesResource.value()).toEqual([]);
  });

  it('should not post when the content is empty', () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);
    fixture.detectChanges();

    component.content.set('   ');
    component.vocabulary.set('');
    component.addNote();

    httpMock.expectNone('/audio-rooms/room-1/notes');
  });

  it('should tokenise vocabulary string into words', () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);

    const result = component.tokeniseVocabulary('hello, world, foo bar');
    expect(result).toEqual(['hello', 'world', 'foo bar']);
  });

  it('should unregister centrifugo on destroy', () => {
    fixture.detectChanges();
    httpMock.expectOne('/audio-rooms/room-1/notes').flush([]);
    fixture.destroy();

    expect(mockCentrifuge.unsubscribe).toHaveBeenCalledWith('room_room-1');
  });
});
