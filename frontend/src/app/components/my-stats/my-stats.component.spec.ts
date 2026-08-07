import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { MyStatsComponent } from './my-stats.component';
import { StatsService, UserStats } from '../../services/stats.service';
import { I18nService } from '../../services/i18n.service';

const MOCK_STATS: UserStats = {
  translations_count: 5,
  corrections_count: 45,
  messages_count: 340,
  moments_count: 12,
};

function mockCanvasContext(): void {
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue({
      canvas: { width: 400, height: 300, style: {} },
      measureText: () => ({ width: 0 }),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      setTransform: vi.fn(),
      fill: vi.fn(),
      strokeText: vi.fn(),
      clip: vi.fn(),
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
}

class MockI18nService {
  translate(key: string): string {
    return key;
  }
}

describe('MyStatsComponent', () => {
  let component: MyStatsComponent;
  let fixture: ComponentFixture<MyStatsComponent>;
  let statsService: { getMyStats: ReturnType<typeof vi.fn> };

  beforeAll(() => {
    mockCanvasContext();
  });

  beforeEach(async () => {
    TestBed.resetTestingModule();
    statsService = { getMyStats: vi.fn().mockResolvedValue(MOCK_STATS) };

    await TestBed.configureTestingModule({
      imports: [MyStatsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: StatsService, useValue: statsService },
        { provide: I18nService, useClass: MockI18nService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeDefined();
  });

  it('should render the title', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const h1 = fixture.nativeElement.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1.textContent).toContain('stats.title');
  });

  it('should render two canvas charts after data loads', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const canvases = fixture.nativeElement.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);
  });

  it('should show loading text while fetching', () => {
    statsService.getMyStats.mockReturnValue(new Promise(() => {}));
    fixture.detectChanges();
    const loadingEl = fixture.nativeElement.querySelector('p');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.textContent).toContain('common.loading');
  });

  it('should show error text on API failure', async () => {
    statsService.getMyStats.mockRejectedValue(new Error('Server error'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const errorEl = fixture.nativeElement.querySelector('.text-red-500');
    expect(errorEl).toBeTruthy();
  });

  it('should populate pie chart with stats data', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const pieData = component['pieChartData']();
    expect(pieData.datasets[0].data).toEqual([340, 45, 12]);
  });

  it('should handle empty stats gracefully', async () => {
    statsService.getMyStats.mockResolvedValue({
      translations_count: 0,
      corrections_count: 0,
      messages_count: 0,
      moments_count: 0,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const pieData = component['pieChartData']();
    expect(pieData.datasets[0].data).toEqual([0, 0, 0]);
  });
});