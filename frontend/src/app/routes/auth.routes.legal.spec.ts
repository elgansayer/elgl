import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '../../environments/environment';
import { DynamicLegalComponent } from '../pages/legal/dynamic-legal.component';
import { I18nService } from '../services/i18n.service';
import { authRoutes } from './auth.routes';

function getRoute(path: string): Route {
  const route = authRoutes.find((candidate) => candidate.path === path);

  expect(route, `Expected public /${path} route`).toBeDefined();
  return route as Route;
}

describe('public legal routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(authRoutes, withComponentInputBinding()),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: I18nService,
          useValue: {
            translate: (key: string) => key,
            currentLang: signal('en-GB'),
          },
        },
      ],
    });
  });

  it.each([
    ['terms', 'Terms of Service - HelloTalk'],
    ['privacy', 'Privacy Policy - HelloTalk'],
    ['legal/:type', 'Legal - HelloTalk'],
  ])('keeps /%s lazy-loaded and available before authentication', (path, title) => {
    const route = getRoute(path);

    expect(route.title).toBe(title);
    expect(route.loadComponent).toBeTypeOf('function');
    expect(route.redirectTo).toBeUndefined();
    expect(route.component).toBeUndefined();
    expect(route.canActivate).toBeUndefined();
    expect(route.canMatch).toBeUndefined();
  });

  it('binds canonical destinations to the shared dynamic page', async () => {
    const terms = getRoute('terms');
    const privacy = getRoute('privacy');

    expect(terms).not.toBe(privacy);
    expect(terms.data?.['type']).toBe('terms');
    expect(privacy.data?.['type']).toBe('privacy');
    expect(await terms.loadComponent?.()).toBe(DynamicLegalComponent);
    expect(await privacy.loadComponent?.()).toBe(DynamicLegalComponent);
  });

  it.each([
    ['/terms', 'terms', 'Terms of Service'],
    ['/privacy', 'privacy', 'Privacy Policy'],
    ['/legal/terms-of-service', 'terms-of-service', 'Terms of Service'],
    ['/legal/privacy-policy', 'privacy-policy', 'Privacy Policy'],
  ])('binds %s and renders its requested document', async (url, type, title) => {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, DynamicLegalComponent);
    const http = TestBed.inject(HttpTestingController);
    const request = http.expectOne(`${environment.apiUrl}/legal/${type}`);

    request.flush({
      title,
      lastUpdated: '2026-07-01',
      sections: [{ id: 'overview', heading: 'Overview', content: 'Document content.' }],
    });

    await harness.fixture.whenStable();
    harness.fixture.detectChanges();

    expect(component.type()).toBe(type);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(title);
    http.verify();
  });
});
