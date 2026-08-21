import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PrivatePartyCreateModalComponent } from './private-party-create-modal.component';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

describe('PrivatePartyCreateModalComponent', () => {
  let component: PrivatePartyCreateModalComponent;
  let fixture: ComponentFixture<PrivatePartyCreateModalComponent>;
  let userServiceMock: { getFollowing: ReturnType<typeof vi.fn> };
  let authServiceMock: { currentUser: ReturnType<typeof signal<{ id: string; is_vip?: boolean } | null>> };
  let i18nServiceMock: ReturnType<typeof createI18nMock>;

  function createI18nMock() {
    return {
      currentLang: signal('en-GB'),
      availableLanguages: [] as string[],
      translate: vi.fn((key: string) => key),
      setLanguage: vi.fn(),
    };
  }

  beforeEach(async () => {
    authServiceMock = {
      currentUser: signal({ id: 'user-1', is_vip: true }),
    };

    userServiceMock = {
      getFollowing: vi.fn().mockResolvedValue({
        data: [
          { id: 'friend-1', display_name: 'Friend One' },
          { id: 'friend-2', display_name: 'Friend Two' },
        ],
        total: 2,
      }),
    };

    i18nServiceMock = createI18nMock();

    await TestBed.configureTestingModule({
      imports: [PrivatePartyCreateModalComponent],
      providers: [
        { provide: UserService, useValue: userServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: I18nService, useValue: i18nServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivatePartyCreateModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load friends on init', async () => {
    await fixture.whenStable();
    expect(userServiceMock.getFollowing).toHaveBeenCalledWith('user-1', 50, 0);
    expect(component.friends().length).toBe(2);
  });

  it('should toggle friend selection', () => {
    component.toggleFriend('friend-1');
    expect(component.selectedFriendIds()).toContain('friend-1');

    component.toggleFriend('friend-1');
    expect(component.selectedFriendIds()).not.toContain('friend-1');
  });

  it('should be invalid without title', () => {
    component.title.set('');
    component.selectedFriendIds.set(['friend-1']);
    expect(component.isValid()).toBe(false);
  });

  it('should be invalid without selected friends', () => {
    component.title.set('Test Party');
    component.selectedFriendIds.set([]);
    expect(component.isValid()).toBe(false);
  });

  it('should be valid with title and at least one friend', () => {
    component.title.set('Test Party');
    component.selectedFriendIds.set(['friend-1']);
    expect(component.isValid()).toBe(true);
  });

  it('should emit created event on submit', () => {
    const emitted: unknown[] = [];
    component.created.subscribe((payload) => emitted.push(payload));

    component.title.set('My Private Party');
    component.languagePair.set('en-es');
    component.topicTag.set('Free Talk');
    component.isVideoStream.set(false);
    component.selectedFriendIds.set(['friend-1', 'friend-2']);
    component.submit();

    expect(emitted[0]).toEqual({
      title: 'My Private Party',
      languagePair: 'en-es',
      topicTag: 'Free Talk',
      isVideoStream: false,
      invitedUserIds: ['friend-1', 'friend-2'],
    });
  });

  it('should reset form on close', () => {
    component.title.set('Test');
    component.selectedFriendIds.set(['friend-1']);
    component.closeModal();

    expect(component.title()).toBe('');
    expect(component.selectedFriendIds()).toEqual([]);
    expect(component.friendSearchQuery()).toBe('');
  });

  it('should filter friends by search query', () => {
    component.friendSearchQuery.set('Friend One');
    expect(component.filteredFriends().length).toBe(1);
    expect(component.filteredFriends()[0].id).toBe('friend-1');

    component.friendSearchQuery.set('nonexistent');
    expect(component.filteredFriends().length).toBe(0);
  });

  it('should return friend by id', () => {
    const friend = component.getFriendById('friend-2');
    expect(friend?.display_name).toBe('Friend Two');
  });
});