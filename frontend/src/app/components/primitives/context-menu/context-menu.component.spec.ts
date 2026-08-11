import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { AppContextMenuComponent } from './context-menu.component';

@Component({
  template: `
    <app-context-menu
      [open]="open()"
      [x]="x()"
      [y]="y()"
      [ariaLabel]="ariaLabel()"
      (dismissed)="onDismissed()"
    >
      <button role="menuitem" type="button">First</button>
      <button role="menuitem" type="button">Second</button>
    </app-context-menu>
  `,
  imports: [AppContextMenuComponent],
})
class TestHostComponent {
  open = signal(false);
  x = signal(10);
  y = signal(20);
  ariaLabel = signal('Actions');
  dismissCount = 0;

  onDismissed(): void {
    this.dismissCount++;
  }
}

describe('AppContextMenuComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, AppContextMenuComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
  });

  function menu(): HTMLElement | null {
    return fixture.nativeElement.querySelector('[role="menu"]');
  }

  function backdrop(): HTMLElement | null {
    return fixture.nativeElement.querySelector('.fixed.inset-0');
  }

  it('should render nothing when closed', () => {
    fixture.detectChanges();
    expect(menu()).toBeNull();
  });

  it('should render at the given x/y position with menu role and aria-label when open', () => {
    host.open.set(true);
    fixture.detectChanges();

    const el = menu();
    expect(el).toBeTruthy();
    expect(el?.style.top).toBe('20px');
    expect(el?.style.left).toBe('10px');
    expect(el?.getAttribute('aria-label')).toBe('Actions');
  });

  it('should project menuitem content', () => {
    host.open.set(true);
    fixture.detectChanges();

    const items = fixture.nativeElement.querySelectorAll('[role="menuitem"]');
    expect(items.length).toBe(2);
    expect(items[0].textContent?.trim()).toBe('First');
    expect(items[1].textContent?.trim()).toBe('Second');
  });

  it('should emit dismissed on backdrop click', () => {
    host.open.set(true);
    fixture.detectChanges();

    backdrop()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.dismissCount).toBe(1);
  });

  it('should not emit dismissed on menu panel click (click stops propagation)', () => {
    host.open.set(true);
    fixture.detectChanges();

    menu()?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.dismissCount).toBe(0);
  });

  it('should emit dismissed on Escape', () => {
    host.open.set(true);
    fixture.detectChanges();

    backdrop()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(host.dismissCount).toBe(1);
  });

  it('should move focus to the first menu item when opened', async () => {
    host.open.set(true);
    fixture.detectChanges();
    await new Promise((resolve) => queueMicrotask(() => resolve(undefined)));

    const items = fixture.nativeElement.querySelectorAll('[role="menuitem"]');
    expect(document.activeElement).toBe(items[0]);
  });

  it('should react to closing after being open', () => {
    host.open.set(true);
    fixture.detectChanges();
    expect(menu()).toBeTruthy();

    host.open.set(false);
    fixture.detectChanges();
    expect(menu()).toBeNull();
  });
});
