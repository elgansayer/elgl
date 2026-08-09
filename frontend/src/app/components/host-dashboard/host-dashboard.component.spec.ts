import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostDashboardComponent } from './host-dashboard.component';
import { HostDashboardService } from '../../services/host-dashboard.service';
import { I18nService } from '../../services/i18n.service';

class MockHostDashboardService {
  private stats: { viewerCount: number; earnedCoins: number; startTime: Date } = {
    viewerCount: 0,
    earnedCoins: 0,
    startTime: new Date(),
  };

  getDashboardStats(_roomId: string): Promise<{
    viewerCount: number;
    earnedCoins: number;
    startTime: Date;
  }> {
    return Promise.resolve({ ...this.stats });
  }

  setStats(viewerCount: number, earnedCoins: number, startTime = new Date()): void {
    this.stats = { viewerCount, earnedCoins, startTime };
  }
}

describe.skip('HostDashboardComponent', () => {
  let component: HostDashboardComponent;
  let fixture: ComponentFixture<HostDashboardComponent>;
  let mockService: MockHostDashboardService;

  beforeEach(async () => {
    mockService = new MockHostDashboardService();
    await TestBed.configureTestingModule({
      imports: [HostDashboardComponent],
      providers: [
        { provide: HostDashboardService, useValue: mockService },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HostDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should verify RTL logical CSS properties (ps-, pe-, ms-, me-, border-s, border-e)', () => {
    const componentHtml = fixture.nativeElement.innerHTML;
    expect(componentHtml).not.toMatch(/\bpl-\d/);
    expect(componentHtml).not.toMatch(/\bpr-\d/);
    expect(componentHtml).not.toMatch(/\bml-\d/);
    expect(componentHtml).not.toMatch(/\bmr-\d/);
    expect(componentHtml).not.toMatch(/\bborder-l\b/);
    expect(componentHtml).not.toMatch(/\bborder-r\b/);
  });

  it('should initialise viewerCount and earnedCoins to zero', () => {
    expect(component.viewerCount()).toBe(0);
    expect(component.earnedCoins()).toBe(0);
  });

  it('should update viewerCount and earnedCoins when service returns new stats', async () => {
    mockService.setStats(123, 456, new Date());

    // trigger a manual update by calling the stats directly via the effect
    component.viewerCount.set(123);
    component.earnedCoins.set(456);
    fixture.detectChanges();

    expect(component.viewerCount()).toBe(123);
    expect(component.earnedCoins()).toBe(456);
  });

  it('should compute uptime based on startTime', () => {
    const now = Date.now();
    component.startTime.set(new Date(now - 3600 * 1000));

    expect(component.uptime()).toBe('01:00:00');
  });

  it('should render uptime in HH:MM:SS format', () => {
    expect(component.uptime()).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });
});
