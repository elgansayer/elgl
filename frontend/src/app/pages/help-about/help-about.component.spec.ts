import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpAboutComponent } from './help-about.component';
import { describe, it, expect, beforeEach } from 'vitest';
import { APP_VERSION, BUILD_NUMBER } from '../../version.constants';

describe('HelpAboutComponent', () => {
  let component: HelpAboutComponent;
  let fixture: ComponentFixture<HelpAboutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelpAboutComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HelpAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display app version from version.constants', () => {
    expect(component.appVersion).toBe(APP_VERSION);
  });

  it('should display build number from version.constants', () => {
    expect(component.buildNumber).toBe(BUILD_NUMBER);
  });

  it('should render app version in the DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(APP_VERSION);
  });

  it('should render build number in the DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(BUILD_NUMBER);
  });

  it('should list open-source licences', () => {
    const licences = component.licences();
    expect(licences.length).toBeGreaterThan(0);
    expect(licences[0].name).toBeTruthy();
    expect(licences[0].licence).toBeTruthy();
  });

  it('should render licence names in the DOM', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('MIT');
    expect(compiled.textContent).toContain('Apache 2.0');
  });
});