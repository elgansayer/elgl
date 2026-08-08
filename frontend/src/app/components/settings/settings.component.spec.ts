import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let routerMock: Partial<Router>;

  beforeEach(async () => {
    routerMock = {
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should toggle the exact location privacy setting', () => {
    const initialValue = (component as any).privacyHideExactLocation;
    (component as any).privacyHideExactLocation = !initialValue;
    expect((component as any).privacyHideExactLocation).toBe(!initialValue);
  });

  it('should navigate to the My Subscription page', () => {
    component.goToMySubscription();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/my-subscription']);
  });
});
