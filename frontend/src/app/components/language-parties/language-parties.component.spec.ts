import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
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

  it('should open create modal', () => {
    expect(component.showCreateModal()).toBe(false);
    component.openCreateModal();
    expect(component.showCreateModal()).toBe(true);
  });

  it('should close create modal', () => {
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

  it('should compute activeFilterCount correctly', () => {
    expect(component.activeFilterCount()).toBe(0);
    component.filterLanguagePair.set('en-es');
    expect(component.activeFilterCount()).toBe(1);
    component.filterTopic.set('Free Talk');
    expect(component.activeFilterCount()).toBe(2);
    component.filterLevel.set('beginner');
    expect(component.activeFilterCount()).toBe(3);
  });

  it('should initialise partiesResource', () => {
    expect(component.partiesResource).toBeDefined();
    expect(component.parties()).toEqual([]);
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
    expect(httpClientMock.get).toHaveBeenLastCalledWith(
      `${environment.apiUrl}/audio-rooms/list?type=language_party`,
    );
  });

  it('creates a language party through the dedicated endpoint and joins it', async () => {
    const createdRoom = {
      id: 'party-1',
      room_name: 'language-party-free-talk-1',
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
    } satisfies AudioRoomRecord;
    httpClientMock.post.mockReturnValueOnce(of(createdRoom));

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
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledWith(createdRoom);
    expect(component.showCreateModal()).toBe(false);
  });

  it('loads the authoritative room before joining a listed party', async () => {
    const room = {
      id: 'party-2',
      room_name: 'language-party-pronunciation-2',
      title: 'Pronunciation',
      target_language: 'ja',
      language_pair: 'en-ja',
      topic_tag: 'Pronunciation',
      host_id: 'host-2',
      is_active: true,
      speakers: ['host-2'],
      raised_hands: [],
      listeners_count: 4,
      created_at: '2026-08-24T00:00:00.000Z',
    } satisfies AudioRoomRecord;
    httpClientMock.get.mockReturnValueOnce(of(room));

    await component.joinParty({ id: room.id });

    expect(httpClientMock.get).toHaveBeenLastCalledWith(
      `${environment.apiUrl}/audio-rooms/${room.id}`,
    );
    expect(audioRoomsStoreMock.joinRoom).toHaveBeenCalledWith(room);
  });

  it('should render the title', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('languageParty.title');
  });

  it('should render the create button', () => {
    const el: HTMLElement = fixture.nativeElement;
    const createBtn = el.querySelector('button');
    expect(createBtn?.textContent).toContain('languageParty.createButton');
  });

  it('should not render modal by default', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-language-party-create-modal')).toBeNull();
  });

  it('should render modal when showCreateModal is true', () => {
    component.showCreateModal.set(true);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('app-language-party-create-modal')).toBeTruthy();
  });

  it('should open modal when create button is clicked', () => {
    const el: HTMLElement = fixture.nativeElement;
    const createBtn = el.querySelector('button') as HTMLButtonElement;
    createBtn.click();
    fixture.detectChanges();
    expect(component.showCreateModal()).toBe(true);
  });
});
