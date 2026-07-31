import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { signal } from '@angular/core';
import { vi, type Mock } from 'vitest';
import { ThemeSelectorComponent } from './theme-selector.component';
import { Theme, ThemeService } from '../../services/theme.service';
import { TranslatePipe } from '../../services/translate.pipe';

// A minimal stub pipe so we do not depend on the real I18nService in tests
@Pipe({ name: 't', standalone: true })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, _params?: Record<string, unknown>): string {
    return key;
  }
}

describe('ThemeSelectorComponent', () => {
  let component: ThemeSelectorComponent;
  let fixture: ComponentFixture<ThemeSelectorComponent>;

  // We inject a manually‑constructed service so tests are hermetic
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
      // 1. Import the real component (this pulls in its own imports)
      imports: [ThemeSelectorComponent],
      providers: [
        { provide: ThemeService, useValue: themeService },
      ],
    })
      // 2. Replace the real TranslatePipe with our standalone stub
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
    // Simulate current theme being 'dark'
    currentTheme.set('dark');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button');
    // The second button (index 1) corresponds to "dark"
    expect(buttons[1].classList.contains('bg-blue-100')).toBe(true);
  });
});
