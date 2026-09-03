import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { InterestsSelectComponent } from './interests-select.component';

describe('InterestsSelectComponent', () => {
  let fixture: ComponentFixture<InterestsSelectComponent>;
  let component: InterestsSelectComponent;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue([
          {
            id: 'interest-travel',
            tag: 'travel',
            name: 'Travel',
            vocabulary: [{ word: 'casa', translation: 'house' }],
          },
        ]),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    await TestBed.configureTestingModule({
      imports: [InterestsSelectComponent],
      providers: [
        {
          provide: AuthService,
          useValue: { getAccessToken: vi.fn(() => 'access-token') },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InterestsSelectComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('targetLanguage', 'es');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('toggles canonical tags and posts the exact tag contract', async () => {
    component.toggleInterest('travel');
    expect(component.selectedTags()).toEqual(new Set(['travel']));

    await component.confirmSelection();

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/interests/select'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ interestTags: ['travel'] }),
      }),
    );
  });
});
