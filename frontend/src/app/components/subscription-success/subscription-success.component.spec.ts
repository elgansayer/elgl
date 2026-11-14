import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { SubscriptionSuccessComponent } from './subscription-success.component';
import { I18nService } from '../../services/i18n.service';

describe('SubscriptionSuccessComponent', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionSuccessComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParams: of(convertToParamMap({})) },
        },
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('navigates to the dashboard', () => {
    const fixture = TestBed.createComponent(SubscriptionSuccessComponent);
    fixture.detectChanges();

    fixture.componentInstance.goToDashboard();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('renders the confirmation copy and a labelled action', () => {
    const fixture = TestBed.createComponent(SubscriptionSuccessComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('subscription.success.title');
    expect(text).toContain('subscription.success.message');

    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent).toContain('subscription.success.dashboardBtn');
    expect(button?.getAttribute('type')).toBe('button');
  });
});
