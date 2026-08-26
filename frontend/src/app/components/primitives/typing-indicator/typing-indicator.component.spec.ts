import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { TypingIndicatorComponent, TypingUser } from './typing-indicator.component';
import { I18nService } from '../../../services/i18n.service';

@Component({
  template: ` <app-typing-indicator [typingUsers]="users()"></app-typing-indicator> `,
  imports: [TypingIndicatorComponent],
})
class TestHostComponent {
  users = signal<TypingUser[]>([]);
}

describe('TypingIndicatorComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;
  const mockI18n = { translate: (k: string) => `[${k}]` };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, TypingIndicatorComponent],
      providers: [{ provide: I18nService, useValue: mockI18n }],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be hidden when no users are typing', () => {
    host.users.set([]);
    fixture.detectChanges();
    const el = fixture.debugElement.query(By.directive(TypingIndicatorComponent));
    expect(el).toBeTruthy();
    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).toBeFalsy();
  });

  it('announces the translated visible status without a hard-coded English aria label', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();

    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).toBeTruthy();
    expect(status.attributes['aria-live']).toBe('polite');
    expect(status.attributes['aria-atomic']).toBe('true');
    expect(status.attributes['aria-label']).toBeUndefined();
    expect(status.nativeElement.textContent).toContain('[typingIndicator.single]');
  });

  it('should show multiple users typing through the translated status', () => {
    host.users.set([
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
    ]);
    fixture.detectChanges();

    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).toBeTruthy();
    expect(status.nativeElement.textContent).toContain('[typingIndicator.multiple]');
  });

  it('renders typing avatars as decorative to avoid duplicate screen-reader announcements', () => {
    host.users.set([{ userId: '1', displayName: 'Alice', avatarUrl: '/alice.png' }]);
    fixture.detectChanges();

    const avatar = fixture.debugElement.query(By.css('img'));
    expect(avatar.attributes['alt']).toBe('');
    expect(avatar.parent?.attributes['aria-hidden']).toBe('true');
  });

  it('should show many users with avatar overflow count', () => {
    const users: TypingUser[] = [
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
      { userId: '3', displayName: 'Charlie' },
      { userId: '4', displayName: 'David' },
      { userId: '5', displayName: 'Eve' },
    ];
    host.users.set(users);
    fixture.detectChanges();
    const avatars = fixture.debugElement.queryAll(By.css('img'));
    expect(avatars.length).toBeLessThanOrEqual(3);
  });

  it('should render three decorative bouncing dots', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();
    const dots = fixture.debugElement.queryAll(By.css('.typing-dot'));
    expect(dots.length).toBe(3);
    expect(dots[0].parent?.attributes['aria-hidden']).toBe('true');
  });
});
