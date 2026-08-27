import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pipe, PipeTransform } from '@angular/core';
import { StreakCongratulationsComponent } from './streak-congratulations.component';
import { TranslatePipe } from '../../services/translate.pipe';

// A minimal stub pipe so we do not depend on the real I18nService in tests,
// and so translation params passed to the pipe are observable in the rendered output.
@Pipe({ name: 't' })
class MockTranslatePipe implements PipeTransform {
  transform(key: string, params?: Record<string, unknown>): string {
    return params ? `${key}:${JSON.stringify(params)}` : key;
  }
}

describe('StreakCongratulationsComponent', () => {
  let component: StreakCongratulationsComponent;
  let fixture: ComponentFixture<StreakCongratulationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreakCongratulationsComponent],
    })
      .overrideComponent(StreakCongratulationsComponent, {
        remove: { imports: [TranslatePipe] },
        add: { imports: [MockTranslatePipe] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(StreakCongratulationsComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('streakDays', 7);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should pass the streak days to the title translation params', () => {
    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('streak_congratulations.title');
    expect(heading.textContent).toContain('"days":7');
  });

  it('should pass the streak days to the subtitle translation params', () => {
    const subtitle = fixture.nativeElement.querySelector('p');
    expect(subtitle.textContent).toContain('streak_congratulations.subtitle');
    expect(subtitle.textContent).toContain('"days":7');
  });

  it('should update the rendered streak days when the input changes', () => {
    fixture.componentRef.setInput('streakDays', 30);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h2');
    expect(heading.textContent).toContain('"days":30');
  });

  it('should render a dialog role with a confetti canvas', () => {
    const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog.querySelector('canvas')).toBeTruthy();
  });

  it('should emit dismiss when the keep going button is clicked', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit dismiss when the overlay is clicked', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    overlay.click();
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit dismiss when the content card is clicked', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const card = fixture.nativeElement.querySelector('h2').parentElement;
    card.click();
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit dismiss when Enter is pressed on the overlay', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit dismiss when Escape is pressed on the overlay', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit dismiss when Space is pressed on the overlay', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(emitSpy).toHaveBeenCalled();
  });

  it('should not emit dismiss for unrelated keys on the overlay', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const overlay = fixture.nativeElement.querySelector('[role="dialog"]');
    overlay.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should not let a keydown on the content card reach the overlay handler', () => {
    const emitSpy = vi.spyOn(component.dismiss, 'emit');
    const card = fixture.nativeElement.querySelector('h2').parentElement;
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should render the celebration emoji', () => {
    expect(fixture.nativeElement.textContent).toContain('🎉');
  });
});
