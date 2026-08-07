import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MyStatsComponent } from './my-stats.component';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../services/i18n.service';

class MockAuthService {
  private token: string | undefined = 'mock-token';

  getAccessToken(): string | undefined {
    return this.token;
  }

  setToken(t: string | undefined) {
    this.token = t;
  }
}

describe('MyStatsComponent', () => {
  let component: MyStatsComponent;
  let fixture: ComponentFixture<MyStatsComponent>;
  let mockAuthService: MockAuthService;

  beforeEach(async () => {
    mockAuthService = new MockAuthService();
    TestBed.resetTestingModule();

    await TestBed.configureTestingModule({
      imports: [MyStatsComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            currentLang: () => 'en-GB',
            direction: () => 'ltr',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MyStatsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render the title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('myStats.title');
  });

  it('should have statsResource defined', () => {
    expect(component.statsResource).toBeDefined();
  });

  it('should compute lineChartData initially as null', () => {
    expect(component.lineChartData()).toBeNull();
  });

  it('should compute pieChartData initially as null', () => {
    expect(component.pieChartData()).toBeNull();
  });

  it('should render the three summary cards', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const cards = compiled.querySelectorAll('.bg-surface-200');
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });
});