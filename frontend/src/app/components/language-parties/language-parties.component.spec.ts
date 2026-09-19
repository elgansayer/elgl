import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { LanguagePartiesComponent } from './language-parties.component';
import { I18nService } from '../../services/i18n.service';
import { AudioRoomsStore, AudioRoomRecord } from '../../services/audio-rooms.store';
import { environment } from '../../../environments/environment';

describe('LanguagePartiesComponent', () => {
  let component: LanguagePartiesComponent;
  let fixture: ComponentFixture<LanguagePartiesComponent>;
  let i18nServiceMock: Partial<I18nService>;
  let httpClientMock: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  let audioRoomsStoreMock: {
    joinRoom: ReturnType<typeof vi.fn>;
  };

  const room = (id = 'party-1'): AudioRoomRecord => ({
    id,
    room_name: `language-party-${id}`,
    title: 'Free Talk',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'Free Talk',
    host_id: 'host-1',
    is_active: true,
    speakers: ['host-1'],
    raised_hands: [],
    listeners_count: 1,
    created_at: '2026-08-24T00:00:00.000Z',
    party_type: 'language_party',
  });

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
    httpClientMock = {
      get: vi.fn().mockReturnValue(of([])),
      post: vi.fn(),
    };
    audioRoomsStoreMock = {
      joinRoom: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LanguagePartiesComponent],
      providers: [
        provideRouter([]),
        { provide: HttpClient, useValue: httpClientMock },
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: AudioRoomsStore, useValue: audioRoomsStoreMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LanguagePartiesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requests only language parties using the backend-supported type query parameter', () => {
    expect(httpClientMock.get).toHaveBeenCalledWith(
      `${environment.apiUrl}/audio-rooms/list?type=language_party`,
    );
    expect(httpClientMock.get).not.toHaveBeenCalledWith(
      expect.stringContaining('party_type=language_party'),
    );
  });

  it('should have default filter values', () => {
    expect(component.filterLanguagePair()).toBe('');
    expect(component.filterTopic()).toBe('');
    expect(component.filterLevel()).toBe('');
    expect(component.showCreateModal()).toBe(false);
    expect(component.creatingParty()).toBe(false);
    expect(component.joiningPartyId()).toBeNull();
  });

  it('should expose language pair options', () => {
    expect(component.languagePairOptions.length).toBe(12);
    expect(component.languagePairOptions[0].value).toBe('en-es');
  });

  it('should expose topic options', () => {
    expect(component.topicOptions.length).toBe(9);
    expect(component.topicOptions[0].value).toBe('Free Talk');
  });

  it('should expose level options', () => {
    expect(component.levelOptions.length).toBe(4);
    expect(component.levelOptions[0].value).toBe('beginner');
  });

  it('should open and close the create modal', () => {
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
    component.closeCreateModal();
    expect(component.showCreateModal()).toBe(false);
  });

  it('should clear filters', () => {
    component.filterLanguagePair.set('en-es');
    component.filterTopic.set('Free Talk');
    component.filterLevel.set('beginner');
    expect(component.activeFilterCount()).toBe(3);

    component.clearFilters();
    expect(component.filterLanguagePair()).toBe('');
    expect(component.filterTopic()).toBe('');
    expect(component.filterLevel()).toBe('');
    expect(component.activeFilterCount()).toBe(0);
  });

  it('surfaces listing failures and supports retry', async () => {
    httpClientMock.get.mockReturnValueOnce(throwError(() => new Error('provider unavailable')));

    component.retryParties();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.partiesResource.error()).toBeTruthy();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert?.textContent).toContain('common.error');

    httpClientMock.get.mockReturnValueOnce(of([]));
    const retryButton = alert?.querySelector('button') as HTMLButtonElement | null;
    retryButton?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.partiesResource.error()).toBeUndefined();
  });

  it('treats an unbounded or malformed list response as unavailable', async () => {
    httpClientMock.get.mockReturnValueOnce(of(Array.from({ length: 51 }, () => room())));

    component.retryParties();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.partiesResource.error()).toBeTruthy();
    expect(component.parties()).toEqual([]);
  });

  it('creates a language party through the dedicated endpoint and joins it', async () => {
    const createdRoom = room('party-created');
    httpClientMock.post.mockReturnValueOnce(of(createdRoom));
    component.openCreateModal();

    await component.onCreateParty({
      title: 'Free Talk',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      level: 'beginner',
      isVideoStream: false,
    });

    expect(httpClientMock.post).toHaveBeenCalledWith(
      `${environment.apiUrl}/audio-rooms/language-parties`,
      {
        title: 'Free Talk',
        language_pair: 'en-es',
        topic_tag: 'Free Talk',
        level: 'beginner',
        is_video_stream: false,
      },
    );
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: createdRoom.id, party_type: 'language_party' }),
    );
    expect(component.showCreateModal()).toBe(false);
    expect(component.createError()).toBeNull();
  });

  it('keeps the modal and draft available when creation fails', async () => {
    httpClientMock.post.mockReturnValueOnce(throwError(() => new Error('database unavailable')));
    component.openCreateModal();

    await component.onCreateParty({
      title: 'Retry me',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      level: 'all',
      isVideoStream: false,
    });

    expect(component.showCreateModal()).toBe(true);
    expect(component.createError()).toBe('languageParty.createError');
    expect(component.creatingParty()).toBe(false);
  });

  it('retries joining a successfully-created room without creating a duplicate party', async () => {
    const createdRoom = room('party-retry');
    httpClientMock.post.mockReturnValueOnce(of(createdRoom));
    audioRoomsStoreMock.joinRoom
      .mockRejectedValueOnce(new Error('LiveKit unavailable'))
      .mockResolvedValueOnce(undefined);
    const payload = {
      title: 'Retry join',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      level: 'all',
      isVideoStream: false,
    };
    component.openCreateModal();

    await component.onCreateParty(payload);
    expect(component.showCreateModal()).toBe(true);
    expect(component.createError()).toBe('languageParty.joinError');

    await component.onCreateParty(payload);

    expect(httpClientMock.post).toHaveBeenCalledTimes(1);
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledTimes(2);
    expect(component.showCreateModal()).toBe(false);
  });

  it('suppresses duplicate create submissions while the first request is in flight', async () => {
    const pending = new Subject<unknown>();
    httpClientMock.post.mockReturnValueOnce(pending.asObservable());
    const payload = {
      title: 'One room only',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      level: 'all',
      isVideoStream: false,
    };

    const first = component.onCreateParty(payload);
    const second = component.onCreateParty(payload);
    expect(httpClientMock.post).toHaveBeenCalledTimes(1);

    pending.next(room('party-one'));
    pending.complete();
    await Promise.all([first, second]);
    expect(httpClientMock.post).toHaveBeenCalledTimes(1);
  });

  it('loads and validates the authoritative room before joining a listed party', async () => {
    const listedRoom = room('party-2');
    httpClientMock.get.mockReturnValueOnce(of(listedRoom));

    await component.joinParty({ id: listedRoom.id });

    expect(httpClientMock.get).toHaveBeenLastCalledWith(
      `${environment.apiUrl}/audio-rooms/${listedRoom.id}`,
    );
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: listedRoom.id }),
    );
  });

  it('rejects stale or mismatched join responses without entering LiveKit', async () => {
    httpClientMock.get.mockReturnValueOnce(of(room('another-party')));

    await component.joinParty({ id: 'party-requested' });

    expect(audioRoomsStoreMock.joinRoom).not.toHaveBeenCalled();
    expect(component.joiningPartyId()).toBeNull();
  });

  it('serializes party joins so rapid clicks cannot start two room connections', async () => {
    const pending = new Subject<unknown>();
    httpClientMock.get.mockReturnValueOnce(pending.asObservable());

    const first = component.joinParty({ id: 'party-a' });
    const second = component.joinParty({ id: 'party-b' });
    expect(component.joiningPartyId()).toBe('party-a');

    pending.next(room('party-a'));
    pending.complete();
    await Promise.all([first, second]);

    expect(httpClientMock.get).toHaveBeenCalledTimes(2); // initial list + one authoritative join lookup
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledTimes(1);
    expect(component.joiningPartyId()).toBeNull();
  });

  it('should render the title and create button', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('languageParty.title');
    expect(el.querySelector('button')?.textContent).toContain('languageParty.createButton');
  });

  it('should render modal only when requested', () => {
    expect(fixture.nativeElement.querySelector('app-language-party-create-modal')).toBeNull();
    component.showCreateModal.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-language-party-create-modal')).toBeTruthy();
  });
});
