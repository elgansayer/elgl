import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let fixture: ComponentFixture<ForgotPasswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show email form when no token query parameter', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('input[type="email"]')).toBeTruthy();
  });

  it('should have invalid email form when empty', () => {
    expect(component.emailForm.invalid).toBeTrue();
  });

  it('should have valid email form when email is filled', () => {
    component.emailForm.controls.email.setValue('test@example.com');
    expect(component.emailForm.valid).toBeTrue();
  });

  it('should have invalid reset form when empty', () => {
    expect(component.resetForm.invalid).toBeTrue();
  });

  it('should have valid reset form when password meets min length', () => {
    component.resetForm.controls.newPassword.setValue('password123');
    expect(component.resetForm.valid).toBeTrue();
  });

  it('should show send button text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const button = compiled.querySelector('button');
    expect(button).toBeTruthy();
  });
});