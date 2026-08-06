import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { ResetPasswordComponent } from './reset-password.component';

describe('ResetPasswordComponent', () => {
  let component: ResetPasswordComponent;
  let fixture: ComponentFixture<ResetPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: new Map<string, string>(),
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResetPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialise token signal from query parameter', () => {
    // token starts empty when no query param present
    expect(component.token()).toBe('');
  });

  it('should show reset password title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const h1 = compiled.querySelector('h1');
    expect(h1).toBeTruthy();
  });

  it('should start with empty token and password signals', () => {
    expect(component.token()).toBe('');
    expect(component.newPassword()).toBe('');
  });

  it('should not submit when token is empty', () => {
    expect(component.submitting()).toBeFalse();
  });

  it('should set token from query param in constructor', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ResetPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'token' ? 'test-token-123' : null),
              },
            },
          },
        },
      ],
    });

    const compFixture = TestBed.createComponent(ResetPasswordComponent);
    const comp = compFixture.componentInstance;
    expect(comp.token()).toBe('test-token-123');
  });
});