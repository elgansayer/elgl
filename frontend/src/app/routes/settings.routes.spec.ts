import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { describe, expect, it, vi } from 'vitest';
import { HelpAboutComponent } from '../pages/help-about/help-about.component';
import { settingsRoutes } from './settings.routes';

describe('settings block-management routes', () => {
  it('owns the settings-scoped block-management destination', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocks');

    expect(route).toBeDefined();
    expect(typeof route?.loadComponent).toBe('function');
    expect(route?.redirectTo).toBeUndefined();
  });

  it('keeps a settings-scoped compatibility alias without duplicating the component', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/blocked-users');

    expect(route?.redirectTo).toBe('settings/blocks');
    expect(route?.pathMatch).toBe('full');
    expect(route?.loadComponent).toBeUndefined();
  });
});

describe('settings Help and About route', () => {
  it('lazy-loads the dedicated Help and About page', () => {
    const route = settingsRoutes.find((candidate) => candidate.path === 'settings/help-about');

    expect(route).toBeDefined();
    expect(typeof route?.loadComponent).toBe('function');
    expect(route?.redirectTo).toBeUndefined();
  });

  it('renders the Help and About page at its canonical settings URL', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal('fetch', mockFetch);
    TestBed.configureTestingModule({ providers: [provideRouter(settingsRoutes)] });

    try {
      const harness = await RouterTestingHarness.create();
      const component = await harness.navigateByUrl('/settings/help-about', HelpAboutComponent);

      expect(component).toBeInstanceOf(HelpAboutComponent);
      expect(mockFetch).toHaveBeenCalledWith('/assets/generated/third-party-licences.json');
      expect(TestBed.inject(Title).getTitle()).toBe('Help & About');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
