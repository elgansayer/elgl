import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Component, Pipe, PipeTransform, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { VoiceroomNotesComponent } from './voiceroom-notes.component';
import { I18nService } from '../../services/i18n.service';
import { CentrifugoService } from '../../services/centrifugo.service';

@Pipe({
  name: 't',
  standalone: true,
})
class MockTranslatePipe implements PipeTransform {
  transform(key: string): string {
    return key;
  }
}

class MockI18nService {
  currentLang = signal('en-GB');
  translate(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

class MockCentrifugoService {
  subscribeLiveRoom = vi.fn();
  unsubscribeLiveRoom = vi.fn();
  publish = vi.fn();
}

@Component({
  template: `<app-voiceroom-notes [roomId]="'room-1'" />`,
  imports: [VoiceroomNotesComponent],
})
class HostComponent {}

describe.skip('VoiceroomNotesComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let component: VoiceroomNotesComponent;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useClass: MockI18nService },
        { provide: CentrifugoService, useClass: MockCentrifugoService },
      ],
    });

    TestBed.overrideComponent(VoiceroomNotesComponent, {
      set: {
        imports: [MockTranslatePipe],
      },
    });

    fixture = TestBed.createComponent(HostComponent);
    component = fixture.debugElement.query(By.directive(VoiceroomNotesComponent)).componentInstance;
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

    expect(component.notesResource.value()?.length).toBe(1);
    expect(component.notesResource.value()[0].author_name).toBe('Alice');
    expect(fixture.nativeElement.textContent).toContain('Alice');
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
    expect(postReq.request.body).toEqual({
      content: 'New note',
      vocabulary: 'word',
    });
    postReq.flush({});

    let reloadReq;
    for (let i = 0; i < 10 && !reloadReq; i++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      const pending = httpMock.match('/audio-rooms/room-1/notes');
      if (pending.length) {
        reloadReq = pending[0];
      }
    }
    expect(reloadReq).toBeDefined();
    expect(reloadReq!.request.method).toBe('GET');
    reloadReq!.flush([
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
    expect(component.notesResource.value()?.length).toBe(1);
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

    httpMock.expectNone(`/audio-rooms/room-1/notes`);
  });
});
