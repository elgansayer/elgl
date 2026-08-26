import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  importProvidersFrom,
  isDevMode,
  PLATFORM_ID,
  provideAppInitializer,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { DOCUMENT, isPlatformServer } from '@angular/common';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { JoyrideModule } from 'ngx-joyride';

import { ConfigurationService } from './core/config/configuration.service';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './services/error-handler.service';
import { DeepLinkService } from './services/deep-link.service';
import { retryInterceptor } from './interceptors/retry.interceptor';

export async function initialiseRuntimeConfiguration(
  configService: Pick<ConfigurationService, 'loadConfiguration'>,
  platformId: object,
): Promise<void> {
  if (isPlatformServer(platformId)) {
    return;
  }

  await configService.loadConfiguration();
}

export function initialiseDeepLinks(
  deepLinkService: Pick<DeepLinkService, 'handleDeepLink'>,
  document: Document,
): void {
  const view = document?.defaultView;
  if (!view) {
    return;
  }

  deepLinkService.handleDeepLink(view.location.href);

  if (typeof view.navigator?.registerProtocolHandler !== 'function') {
    return;
  }

  try {
    view.navigator.registerProtocolHandler(
      'web+hellotalk',
      `${view.location.origin}/%s`,
    );
  } catch {
    // Protocol handler registration is best-effort; browser policy may reject it.
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([retryInterceptor])),
    provideClientHydration(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({ lang: 'en-GB' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    importProvidersFrom(JoyrideModule.forRoot()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() =>
      initialiseRuntimeConfiguration(
        inject(ConfigurationService),
        inject(PLATFORM_ID),
      ),
    ),
    provideAppInitializer(() =>
      initialiseDeepLinks(inject(DeepLinkService), inject(DOCUMENT)),
    ),
  ],
};