import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HostDashboardComponent } from './host-dashboard.component';
import { HostDashboardService } from '../../services/host-dashboard.service';
import { I18nService } from '../../services/i18n.service';
import { BehaviorSubject } from 'rxjs';

class MockHostDashboardService {
  private stats = new BehaviorSubject<{
    viewerCount: number;
    earnedCoins: number;
    startTime: Date;
  }>({
    viewerCount: 0,
    earnedCoins: 0,
    startTime: new Date(),
  });

  getDashboardStats(_roomId: string) {
    return this.stats.asObservable();
  }

  emitStats(viewerCount: number, earnedCoins: number, startTime = new Date()) {
    this.stats.next({ viewerCount, earnedCoins, startTime });
  }
}

describe('HostDashboardComponent', () => {
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

  it('should initialise viewerCount and earnedCoins to zero', () => {
    expect(component.viewerCount()).toBe(0);
    expect(component.earnedCoins()).toBe(0);
  });

  it('should update viewerCount and earnedCoins when service emits new stats', () => {
    mockService.emitStats(123, 456, new Date());
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
