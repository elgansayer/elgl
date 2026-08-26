import {
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { filter, firstValueFrom, from, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ChatE2eeService } from '../services/chat-e2ee.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function responseFor(
  next: HttpHandlerFn,
  request: HttpRequest<unknown>,
): Promise<HttpResponse<unknown>> {
  return await firstValueFrom(
    next(request).pipe(
      filter((event): event is HttpResponse<unknown> => event instanceof HttpResponse),
    ),
  );
}

function isSendMessageRequest(request: HttpRequest<unknown>): boolean {
  return (
    request.method === 'POST' &&
    request.url.replace(/\?.*$/, '').replace(/\/$/, '') ===
      `${environment.apiUrl}/chat/messages`.replace(/\/$/, '')
  );
}

function roomIdFromHistoryRequest(request: HttpRequest<unknown>): string | null {
  if (request.method !== 'GET') return null;
  const prefix = `${environment.apiUrl}/chat/messages/`;
  const cleanUrl = request.url.replace(/\?.*$/, '');
  if (!cleanUrl.startsWith(prefix)) return null;
  const roomId = cleanUrl.slice(prefix.length);
  return roomId && !roomId.includes('/') ? decodeURIComponent(roomId) : null;
}

function matchesSearch(message: unknown, search: string): boolean {
  if (!isRecord(message)) return false;
  const haystacks: string[] = [];
  if (typeof message['text_content'] === 'string') haystacks.push(message['text_content']);
  const correction = message['correction_payload'];
  if (isRecord(correction)) {
    for (const key of ['original', 'corrected', 'explanation']) {
      if (typeof correction[key] === 'string') haystacks.push(correction[key]);
    }
  }
  return haystacks.some((value) => value.toLocaleLowerCase().includes(search));
}

export const chatE2eeInterceptor: HttpInterceptorFn = (
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const e2ee = inject(ChatE2eeService);

  if (isSendMessageRequest(request)) {
    return from(handleSend(request, next, e2ee));
  }

  const roomId = roomIdFromHistoryRequest(request);
  if (roomId) {
    return from(handleHistory(request, next, e2ee));
  }

  return next(request);
};

async function fetchDirectory(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  roomId: string,
): Promise<unknown> {
  const directoryRequest = new HttpRequest(
    'GET',
    `${environment.apiUrl}/chat/e2ee/rooms/${encodeURIComponent(roomId)}/devices`,
    { headers: request.headers },
  );
  return (await responseFor(next, directoryRequest)).body;
}

async function registerCurrentDevice(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  e2ee: ChatE2eeService,
): Promise<void> {
  const registration = await e2ee.getRegistration();
  const registerRequest = new HttpRequest(
    'PUT',
    `${environment.apiUrl}/chat/e2ee/devices/current`,
    registration,
    { headers: request.headers },
  );
  await responseFor(next, registerRequest);
}

async function handleSend(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  e2ee: ChatE2eeService,
): Promise<HttpEvent<unknown>> {
  if (!isRecord(request.body) || typeof request.body['room_id'] !== 'string') {
    return await responseFor(next, request);
  }

  const roomId = request.body['room_id'];
  if (!e2ee.isSupported()) {
    const directory = e2ee.parseDirectory(await fetchDirectory(request, next, roomId));
    if (directory.personal) {
      throw new Error('End-to-end encryption is required for personal chats');
    }
    return await responseFor(next, request);
  }

  await registerCurrentDevice(request, next, e2ee);
  const directory = await fetchDirectory(request, next, roomId);
  const parsedDirectory = e2ee.parseDirectory(directory);
  if (!parsedDirectory.personal) {
    return await responseFor(next, request);
  }

  const encrypted = await e2ee.encryptOutgoingMessage(
    request.body as {
      room_id: string;
      message_type: string;
      text_content?: unknown;
      media_url?: unknown;
      correction_payload?: unknown;
      correction_request_payload?: unknown;
      status_reply_payload?: unknown;
      reply_to_id?: unknown;
    },
    parsedDirectory,
  );
  const encryptedRequest = request.clone({
    url: `${environment.apiUrl}/chat/e2ee/messages`,
    body: encrypted,
  });
  const response = await responseFor(next, encryptedRequest);
  return response.clone({ body: await e2ee.decryptMessage(response.body) });
}

async function handleHistory(
  request: HttpRequest<unknown>,
  next: HttpHandlerFn,
  e2ee: ChatE2eeService,
): Promise<HttpEvent<unknown>> {
  if (e2ee.isSupported()) {
    await registerCurrentDevice(request, next, e2ee);
  }

  // Encrypted plaintext is intentionally not searchable in PostgreSQL. Fetch
  // the bounded room history and apply an optional room search after decrypting
  // on the device instead.
  const search = request.params.get('search')?.trim().toLocaleLowerCase() ?? '';
  const historyRequest = search
    ? request.clone({ params: request.params.delete('search') })
    : request;
  const response = await responseFor(next, historyRequest);
  if (!Array.isArray(response.body)) return response;

  const decrypted = await Promise.all(response.body.map((message) => e2ee.decryptMessage(message)));
  const filtered = search ? decrypted.filter((message) => matchesSearch(message, search)) : decrypted;
  return response.clone({ body: filtered });
}
