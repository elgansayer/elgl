import {
  APP_INITIALIZER,
  ApplicationConfig,
  ErrorHandler,
  inject,
  importProvidersFrom,
  isDevMode,
  PLATFORM_ID,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { DOCUMENT, isPlatformServer } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { JoyrideModule } from 'ngx-joyride';

import { ConfigurationService } from './core/config/configuration.service';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './services/error-handler.service';
import { DeepLinkService } from './services/deep-link.service';
import { retryInterceptor } from './interceptors/retry.interceptor';
import { chatE2eeInterceptor } from './interceptors/chat-e2ee.interceptor';

export function initConfig(
  configService: ConfigurationService,
  platformId: object,
): () => Promise<void> {
  return () =>
    isPlatformServer(platformId) ? Promise.resolve() : configService.loadConfiguration();
}

function initialiseDeepLinks(): () => void {
  const deepLinkService = inject(DeepLinkService);
  const document = inject(DOCUMENT);

  return (): void => {
    const url = document?.defaultView?.location?.href;
    if (url) {
      deepLinkService.handleDeepLink(url);
    }

    if (typeof document?.defaultView?.navigator?.registerProtocolHandler === 'function') {
      try {
        document.defaultView.navigator.registerProtocolHandler(
          'web+hellotalk',
          `${document.defaultView.location.origin}/%s`,
        );
      } catch {
        // Protocol handler registration is best-effort; browser may reject it silently
      }
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding()),
    // E2EE runs before retry so a transient retry reuses the same ciphertext
    // instead of producing a second logical encryption operation.
    provideHttpClient(withFetch(), withInterceptors([chatE2eeInterceptor, retryInterceptor])),
    provideClientHydration(),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideTranslateService({ lang: 'en-GB' }),
    provideTranslateHttpLoader({ prefix: './assets/i18n/', suffix: '.json' }),
    importProvidersFrom(JoyrideModule.forRoot()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },

    {
      provide: APP_INITIALIZER,
      useFactory: initConfig,
      deps: [ConfigurationService, PLATFORM_ID],
      multi: true,
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initialiseDeepLinks,
      multi: true,
    },
  ],
};
