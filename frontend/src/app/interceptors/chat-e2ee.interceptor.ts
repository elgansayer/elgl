import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { concatMap, switchMap } from 'rxjs/operators';
import { ChatE2eeService } from '../services/chat-e2ee.service';

function isLegacySendRequest(request: HttpRequest<unknown>): boolean {
  return request.method === 'POST' && /\/chat\/messages$/.test(request.url);
}

function isMessageHistoryRequest(request: HttpRequest<unknown>): boolean {
  return request.method === 'GET' && /\/chat\/messages\/[^/]+$/.test(request.url);
}

function decryptResponseEvent(
  service: ChatE2eeService,
  event: HttpEvent<unknown>,
): Observable<HttpEvent<unknown>> {
  if (!(event instanceof HttpResponse)) return of(event);
  const body = event.body;
  if (Array.isArray(body)) {
    return from(Promise.all(body.map((item) => service.decryptMessage(item)))).pipe(
      switchMap((decrypted) => of(event.clone({ body: decrypted }))),
    );
  }
  if (service.isEncryptedStoredMessage(body)) {
    return from(service.decryptMessage(body)).pipe(
      switchMap((decrypted) => of(event.clone({ body: decrypted }))),
    );
  }
  return of(event);
}

export const chatE2eeInterceptor: HttpInterceptorFn = (request, next) => {
  const service = inject(ChatE2eeService);

  // Requests made by ChatE2eeService itself must bypass this interceptor to
  // avoid recursion while registering a device or discovering room keys.
  if (request.url.includes('/chat/e2ee/')) return next(request);

  if (isLegacySendRequest(request)) {
    return from(service.prepareOutgoing(request.body)).pipe(
      switchMap((prepared) => {
        const outbound = prepared.encrypted
          ? request.clone({
              url: request.url.replace(/\/chat\/messages$/, '/chat/e2ee/messages'),
              body: prepared.body,
            })
          : request;
        return next(outbound).pipe(concatMap((event) => decryptResponseEvent(service, event)));
      }),
    );
  }

  if (isMessageHistoryRequest(request)) {
    return next(request).pipe(concatMap((event) => decryptResponseEvent(service, event)));
  }

  return next(request);
};
