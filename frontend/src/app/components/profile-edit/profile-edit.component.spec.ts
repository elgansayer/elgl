import { TestBed } from '@angular/core/testing';
import { ProfileEditComponent } from './profile-edit.component';
import { UserProfile, UserService } from '../../services/user.service';
import { I18nService } from '../../services/i18n.service';

describe('ProfileEditComponent', () => {
  const profile = {
    id: 'user-1',
    display_name: 'Ana',
    gender: 'female',
    business_name: 'Ana Languages',
    business_hours: '09:00-17:00',
    website_url: 'https://ana.example.com',
    cover_photo_url: null,
  } as unknown as UserProfile;

  let userService: {
    getMyProfile: ReturnType<typeof vi.fn>;
    updateMyProfile: ReturnType<typeof vi.fn>;
    getPresignedCoverPhotoUrl: ReturnType<typeof vi.fn>;
    updateCoverPhotoUrl: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    userService = {
      getMyProfile: vi.fn().mockResolvedValue(profile),
      updateMyProfile: vi.fn().mockResolvedValue(profile),
      getPresignedCoverPhotoUrl: vi.fn().mockResolvedValue({
        uploadUrl: 'https://upload.example.com/cover',
        mediaUrl: 'https://cdn.example.com/cover.jpg',
      }),
      updateCoverPhotoUrl: vi.fn().mockResolvedValue({
        ...profile,
        cover_photo_url: 'https://cdn.example.com/cover.jpg',
      }),
    };

    await TestBed.configureTestingModule({
      imports: [ProfileEditComponent],
      providers: [
        { provide: UserService, useValue: userService },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hydrates the editable signals from the profile', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;

    expect(userService.getMyProfile).toHaveBeenCalledTimes(1);
    expect(component.profile()).toEqual(profile);
    expect(component.displayName()).toBe('Ana');
    expect(component.gender()).toBe('female');
    expect(component.businessName()).toBe('Ana Languages');
    expect(component.websiteUrl()).toBe('https://ana.example.com');
  });

  it('saves the edited profile fields', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.displayName.set('Ana Maria');
    component.gender.set('');
    component.businessName.set('');
    component.businessHours.set('10:00-18:00');
    component.websiteUrl.set('');

    await component.saveProfile();

    expect(userService.updateMyProfile).toHaveBeenCalledWith({
      display_name: 'Ana Maria',
      gender: '',
      business_name: undefined,
      business_hours: '10:00-18:00',
      website_url: undefined,
    });
  });

  it('opens the cropper for a selected image', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const input = document.createElement('input');
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });

    component.onFileSelected({ target: input } as unknown as Event);

    expect(component.selectedFile()).toBe(file);
    expect(component.showCropper()).toBe(true);
  });

  it('uploads the cropped cover and stores the returned profile', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200 } as Response);
    vi.stubGlobal('fetch', fetchMock);

    await component.onSaveCroppedCover(new Blob(['image'], { type: 'image/jpeg' }));

    expect(userService.getPresignedCoverPhotoUrl).toHaveBeenCalledWith(
      'cover-photo.jpg',
      'image/jpeg',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://upload.example.com/cover',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(userService.updateCoverPhotoUrl).toHaveBeenCalledWith(
      'https://cdn.example.com/cover.jpg',
    );
    expect(component.coverPhotoPreview()).toBe(
      'https://cdn.example.com/cover.jpg',
    );
    expect(component.isUploading()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('clears the upload flag when the storage upload fails', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response),
    );

    await component.onSaveCroppedCover(new Blob(['image'], { type: 'image/jpeg' }));

    expect(userService.updateCoverPhotoUrl).not.toHaveBeenCalled();
    expect(component.isUploading()).toBe(false);
    vi.unstubAllGlobals();
  });

  it('renders labelled form controls with an accessible save action', async () => {
    const fixture = TestBed.createComponent(ProfileEditComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const labels = fixture.nativeElement.querySelectorAll('label, span');
    expect(labels.length).toBeGreaterThan(0);
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ) as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.textContent?.trim()).not.toBe('');
    }
  });
});
