import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { signal } from '@angular/core';
import { vi, type Mock } from 'vitest';
import { ThemeSelectorComponent } from './theme-selector.component';
import { Theme, ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../services/translate.pipe';

@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

describe('ThemeSelectorComponent', () => {
  let component: ThemeSelectorComponent;
  let fixture: ComponentFixture<ThemeSelectorComponent>;
  let currentTheme: ReturnType<typeof signal<Theme>>;
  let setThemeSpy: Mock;

  beforeEach(async () => {
    currentTheme = signal<Theme>('light');
    setThemeSpy = vi.fn((theme: Theme) => {
      currentTheme.set(theme);
    });

    const themeService: Partial<ThemeService> = {
      currentTheme: currentTheme,
      setTheme: setThemeSpy,
    };

    await TestBed.configureTestingModule({
      imports: [ThemeSelectorComponent],
      providers: [{ provide: ThemeService, useValue: themeService }],
    })
      .overrideComponent(ThemeSelectorComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ThemeSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render three theme buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(3);
  });

  it('should call setTheme with light when the first button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[0].click();
    expect(setThemeSpy).toHaveBeenCalledWith('light');
  });

  it('should call setTheme with dark when the second button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[1].click();
    expect(setThemeSpy).toHaveBeenCalledWith('dark');
  });

  it('should call setTheme with system when the third button is clicked', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    buttons[2].click();
    expect(setThemeSpy).toHaveBeenCalledWith('system');
  });

  it('should apply the active style class for the current theme', () => {
    currentTheme.set('dark');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[1].classList.contains('bg-primary/15')).toBe(true);
  });

  it('should have accessible ARIA attributes for theme buttons', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('theme.light');
    expect(buttons[1].getAttribute('aria-label')).toBe('theme.dark');
    expect(buttons[2].getAttribute('aria-label')).toBe('theme.system');
  });

  it('should use symmetric RTL-safe spacing from the owned Helm compact size', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].classList.contains('px-2.5')).toBe(true);
    expect(buttons[1].classList.contains('px-2.5')).toBe(true);
    expect(buttons[0].className).not.toMatch(/\b(?:pl|pr)-/);
  });

  it('should use the TranslatePipe for button labels', () => {
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].textContent.trim()).toBe('theme.light');
    expect(buttons[1].textContent.trim()).toBe('theme.dark');
    expect(buttons[2].textContent.trim()).toBe('theme.system');
  });
});
