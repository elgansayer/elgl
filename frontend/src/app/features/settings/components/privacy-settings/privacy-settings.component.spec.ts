import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PrivacySettingsComponent } from './privacy-settings.component';

describe('PrivacySettingsComponent', () => {
  let component: PrivacySettingsComponent;
  let fixture: ComponentFixture<PrivacySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacySettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PrivacySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have three visibility options', () => {
    expect(component.visibilityOptions.length).toBe(3);
    expect(component.visibilityOptions.map(o => o.value)).toEqual([
      'everyone',
      'vips_only',
      'hidden',
    ]);
  });

  it('should default profileVis to everyone', () => {
    expect(component.profileVis()).toBe('everyone');
  });

  it('should change visibility via setVisibility', () => {
    component.setVisibility('vips_only');
    expect(component.profileVis()).toBe('vips_only');
  });

  it('should toggle allowDm', () => {
    const initial = component.allowDm();
    component.toggleAllowDm();
    expect(component.allowDm()).toBe(!initial);
  });

  it('should render visibility buttons in the template', () => {
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('[role="radiogroup"] button');
    expect(buttons.length).toBe(3);
  });
});
