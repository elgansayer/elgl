<<<<<<< HEAD
import { ApplicationConfig, ErrorHandler, inject, isDevMode, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
=======
import { ApplicationConfig, ErrorHandler, importProvidersFrom, inject, isDevMode, APP_INITIALIZER } from '@angular/core';
>>>>>>> origin/main
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, HttpClient } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { JoyrideModule } from 'ngx-joyride';
import { routes } from './app.routes';
import { GlobalErrorHandler } from './services/error-handler.service';
import { DeepLinkService } from './services/deep-link.service';

export function createTranslateLoader(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
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
    provideHttpClient(withFetch()),
    provideClientHydration(),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    importProvidersFrom(JoyrideModule.forRoot()),
    ...(TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: createTranslateLoader,
        deps: [HttpClient],
      },
      defaultLanguage: 'en-GB',
    }).providers ?? []),
    importProvidersFrom(JoyrideModule.forRoot()),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initialiseDeepLinks,
      multi: true,
    },
  ],
};
