import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { MyStatsComponent } from './my-stats.component';
import { I18nService } from '../../services/i18n.service';

const i18nMock = {
  translate: (key: string, _params?: Record<string, unknown>): string => {
    const translations: Record<string, string> = {
      'myStats.title': 'My Stats',
      'myStats.studyHoursThisWeek': 'Study Hours (This Week)',
      'myStats.activityBreakdown': 'Activity Breakdown',
      'myStats.messagesSent': 'Messages Sent',
      'myStats.correctionsMade': 'Corrections Made',
      'myStats.momentsPosted': 'Moments Posted',
      'myStats.studyHours': 'Study Hours',
      'myStats.mon': 'Mon',
      'myStats.tue': 'Tue',
      'myStats.wed': 'Wed',
      'myStats.thu': 'Thu',
      'myStats.fri': 'Fri',
      'myStats.sat': 'Sat',
      'myStats.sun': 'Sun',
    };
    return translations[key] ?? key;
  },
  currentLang: () => 'en-GB',
  direction: () => 'ltr',
};

function setupCanvasMock() {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      return {
        canvas: this,
        resetTransform: () => {},
        setTransform: () => {},
        save: () => {},
        restore: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        clearRect: () => {},
        fillRect: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: (s: string) => ({ width: s.length * 6 }),
        getImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
        putImageData: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        clip: () => {},
        createLinearGradient: () => null,
        createRadialGradient: () => null,
        createPattern: () => null,
        drawImage: () => {},
        setLineDash: () => {},
        getLineDash: () => [],
        getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        rect: () => {},
        ellipse: () => {},
        isPointInPath: () => false,
        arcTo: () => {},
        createImageData: () => ({ data: new Uint8ClampedArray(), width: 0, height: 0 }),
        globalAlpha: 1,
        globalCompositeOperation: 'source-over' as string,
        lineWidth: 1,
        font: '',
        textAlign: 'left' as CanvasTextAlign,
        textBaseline: 'alphabetic' as CanvasTextBaseline,
        direction: 'ltr' as CanvasDirection,
      } as unknown as CanvasRenderingContext2D;
    }
    return origGetContext.call(this, contextType);
  } as typeof HTMLCanvasElement.prototype.getContext;
}

async function createTestBed() {
  setupCanvasMock();
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MyStatsComponent],
    providers: [{ provide: I18nService, useValue: i18nMock }],
  }).compileComponents();
}

describe('MyStatsComponent signal data', () => {
  let component: MyStatsComponent;

  beforeEach(async () => {
    await createTestBed();
    const fixture = TestBed.createComponent(MyStatsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should compute lineChartData with translated labels', () => {
    const data = component.lineChartData();
    expect(data.labels).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(data.datasets[0].data).toEqual([1.5, 2, 1, 3.5, 2.5, 4, 3]);
    expect(data.datasets[0].label).toBe('Study Hours');
  });

  it('should compute pieChartData with translated labels', () => {
    const data = component.pieChartData();
    expect(data.labels).toEqual(['Messages Sent', 'Corrections Made', 'Moments Posted']);
    expect(data.datasets[0].data).toEqual([340, 45, 12]);
  });

  it('should have responsive lineChartOptions', () => {
    expect(component.lineChartOptions.responsive).toBe(true);
    expect(component.lineChartOptions.plugins?.legend?.display).toBe(false);
  });

  it('should have responsive pieChartOptions', () => {
    expect(component.pieChartOptions.responsive).toBe(true);
  });
});

describe('MyStatsComponent DOM', () => {
  it('should render charts layout', async () => {
    setupCanvasMock();
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [MyStatsComponent],
      providers: [{ provide: I18nService, useValue: i18nMock }],
    }).compileComponents();

    const fixture = TestBed.createComponent(MyStatsComponent);
    fixture.detectChanges();

    const title = fixture.nativeElement.querySelector('h1');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('My Stats');

    const canvases = fixture.nativeElement.querySelectorAll('canvas');
    expect(canvases.length).toBe(2);

    const headings = fixture.nativeElement.querySelectorAll('h2');
    expect(headings.length).toBe(2);
    expect(headings[0].textContent).toContain('Study Hours');
    expect(headings[1].textContent).toContain('Activity Breakdown');
  });
});