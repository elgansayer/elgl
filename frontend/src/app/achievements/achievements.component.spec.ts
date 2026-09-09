import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AchievementsComponent } from './achievements.component';
import { TranslatePipe } from '../services/translate.pipe';

interface FullAchievementDto {
  code: string;
  name: string;
  description: string;
  current: number;
  required: number;
  earned: boolean;
}

describe('AchievementsComponent', () => {
  let component: AchievementsComponent;
  let fixture: ComponentFixture<AchievementsComponent>;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AchievementsComponent, TranslatePipe],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AchievementsComponent);
    component = fixture.componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('userId', 'user-123');
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    fixture.detectChanges();
    httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123').flush([]);
  });

  it('should show a loading state while fetching achievements', () => {
    fixture.detectChanges();
    expect(component.achievementsResource.isLoading()).toBe(true);
    const status = fixture.nativeElement.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123').flush([]);
  });

  it('should render earned and locked achievements when the API responds', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123');
    const mockAchievements: FullAchievementDto[] = [
      {
        code: 'first_message',
        name: 'First Message',
        description: 'Send your first message in a chat.',
        current: 1,
        required: 1,
        earned: true,
      },
      {
        code: '100_messages',
        name: '100 Messages',
        description: 'Send 100 messages in chats.',
        current: 40,
        required: 100,
        earned: false,
      },
    ];
    req.flush(mockAchievements);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.achievementsResource.isLoading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('First Message');
    expect(fixture.nativeElement.textContent).toContain('100 Messages');

    const progressBars = fixture.nativeElement.querySelectorAll('[role="progressbar"]');
    expect(progressBars.length).toBe(2);
    expect(progressBars[1].getAttribute('aria-valuenow')).toBe('40');
    expect(progressBars[1].getAttribute('aria-valuemax')).toBe('100');
  });

  it('should show an empty state when no achievements are defined', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123');
    req.flush([]);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No achievements available yet.');
  });

  it('should show an error state when the API fails', async () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123');
    req.error(new ErrorEvent('Network error'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.achievementsResource.error()).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Failed to load achievements.');
  });

  it('progressPercent caps at 100 and handles a zero requirement', () => {
    expect(
      component.progressPercent({
        code: 'x',
        name: 'x',
        description: 'x',
        current: 500,
        required: 100,
        earned: true,
      }),
    ).toBe(100);
    expect(
      component.progressPercent({
        code: 'x',
        name: 'x',
        description: 'x',
        current: 0,
        required: 0,
        earned: false,
      }),
    ).toBe(0);
    fixture.detectChanges();
    httpTesting.expectOne('http://127.0.0.1:3000/api/achievements/full/user-123').flush([]);
  });
});
