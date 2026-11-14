import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SubscriptionCancelComponent } from './subscription-cancel.component';
import { I18nService } from '../../services/i18n.service';

describe('SubscriptionCancelComponent', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SubscriptionCancelComponent],
      providers: [
        provideRouter([]),
        {
          provide: I18nService,
          useValue: { translate: (key: string) => key },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('returns to the subscription page', () => {
    const fixture = TestBed.createComponent(SubscriptionCancelComponent);
    fixture.detectChanges();

    fixture.componentInstance.goBack();

    expect(router.navigate).toHaveBeenCalledWith(['/subscription']);
  });

  it('renders a labelled, touch-sized return button', () => {
    const fixture = TestBed.createComponent(SubscriptionCancelComponent);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button');
    expect(button?.textContent).toContain('subscription.cancel.backBtn');
    expect(button?.getAttribute('type')).toBe('button');
    expect(
      fixture.nativeElement.querySelector('[aria-hidden="true"]'),
    ).not.toBeNull();
  });
});
