import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewTransitionNameDirective } from './view-transition-name.directive';

@Component({
  standalone: true,
  imports: [ViewTransitionNameDirective],
  template: `
    <img
      alt=""
      [appViewTransitionName]="name()"
      [appViewTransitionDisabled]="disabled()"
    />
  `,
})
class TestHostComponent {
  readonly name = signal('profile_avatar_user_1');
  readonly disabled = signal(false);
}

describe('ViewTransitionNameDirective', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('applies a bounded stable transition name', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLElement;
    expect(image.style.getPropertyValue('view-transition-name')).toBe(
      'profile_avatar_user_1',
    );
  });

  it('removes the name when the transition is disabled', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('img') as HTMLElement;
    expect(image.style.getPropertyValue('view-transition-name')).toBe('');
  });

  it('rejects user-content-like or invalid names', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.name.set('user@example.com/avatar url');

    expect(() => fixture.detectChanges()).toThrow(
      'View transition names must begin with a letter',
    );
  });
});
