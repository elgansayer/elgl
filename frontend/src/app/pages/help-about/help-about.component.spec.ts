import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpAboutComponent } from './help-about.component';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_VERSION, BUILD_NUMBER } from '../../version.constants';

const manifest = [
  {
    id: '@angular/core@22.1.1',
    name: '@angular/core',
    version: '22.1.1',
    licence: 'MIT',
    packageUrl: 'https://www.npmjs.com/package/@angular/core/v/22.1.1',
  },
];

describe('HelpAboutComponent', () => {
  let component: HelpAboutComponent;
  let fixture: ComponentFixture<HelpAboutComponent>;
  const mockFetch = vi.fn();

  const createComponent = () => {
    fixture = TestBed.createComponent(HelpAboutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(manifest),
    });
    vi.stubGlobal('fetch', mockFetch);

    await TestBed.configureTestingModule({
      imports: [HelpAboutComponent],
    }).compileComponents();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('should create', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('should display generated app version and build number', () => {
    createComponent();

    expect(component.appVersion).toBe(APP_VERSION);
    expect(component.buildNumber).toBe(BUILD_NUMBER);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain(APP_VERSION);
    expect(compiled.textContent).toContain(BUILD_NUMBER);
  });

  it('should load the packaged production licence manifest', async () => {
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockFetch).toHaveBeenCalledWith('/assets/generated/third-party-licences.json');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('@angular/core');
    expect(compiled.textContent).toContain('22.1.1');
    expect(compiled.textContent).toContain('MIT');

    const link = compiled.querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://www.npmjs.com/package/@angular/core/v/22.1.1');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should expose a status while the licence manifest is loading', () => {
    mockFetch.mockReturnValue(new Promise(() => undefined));
    createComponent();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement | null;
    expect(status).not.toBeNull();
  });

  it('should render an empty state when the manifest contains no production packages', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('li')).toHaveLength(0);
    expect(compiled.textContent).toContain('No results found.');
  });

  it('should render a translated error state when the manifest request fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement | null;
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('Something went wrong');
  });

  it('should fail closed when the manifest payload is malformed', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ packages: manifest }),
    });
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
