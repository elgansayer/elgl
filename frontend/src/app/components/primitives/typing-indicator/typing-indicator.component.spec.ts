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

  it('should show single user typing', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();
    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).toBeTruthy();
    expect(status.attributes['aria-label']).toContain('Alice');
    expect(status.attributes['aria-live']).toBe('polite');
  });

  it('should show multiple users typing', () => {
    host.users.set([
      { userId: '1', displayName: 'Alice' },
      { userId: '2', displayName: 'Bob' },
    ]);
    fixture.detectChanges();
    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).toBeTruthy();
    expect(status.attributes['aria-label']).toContain('Alice');
    expect(status.attributes['aria-label']).toContain('Bob');
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

  it('should render three bouncing dots', () => {
    host.users.set([{ userId: '1', displayName: 'Alice' }]);
    fixture.detectChanges();
    const dots = fixture.debugElement.queryAll(By.css('.typing-dot'));
    expect(dots.length).toBe(3);
  });
});