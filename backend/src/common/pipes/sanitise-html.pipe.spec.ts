import { ArgumentMetadata } from '@nestjs/common';

vi.mock('jsdom', () => ({
  JSDOM: vi.fn().mockImplementation(function () {
    return {
      window: {
        document: {
          createElement: vi.fn(),
          createDocumentFragment: vi.fn(),
        },
        Node: {
          ELEMENT_NODE: 1,
          TEXT_NODE: 3,
          DOCUMENT_FRAGMENT_NODE: 11,
        },
        NodeFilter: {
          SHOW_ELEMENT: 1,
          SHOW_TEXT: 4,
        },
      },
    };
  }),
}));

const { mockSanitize } = vi.hoisted(() => {
  const mockSanitize = (dirty: string): string => {
    if (typeof dirty !== 'string') return dirty;
    let result = dirty
      .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
    result = result.replace(/<[^>]*>/g, '');
    return result
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'");
  };
  return { mockSanitize };
});

vi.mock('dompurify', () => ({
  __esModule: true,
  default: vi.fn(() => ({
    sanitize: mockSanitize,
  })),
}));

import {
  SANITISATION_EXEMPT_FIELDS,
  SANITISATION_EXEMPT_KEYS,
  SanitiseHtmlPipe,
} from './sanitise-html.pipe';
import {
  ClientErrorDto,
  LogClientErrorDto,
} from '../../analytics/dto/client-error.dto';
import { AppleNotificationDto } from '../../monetisation/dto/apple-notification.dto';
import { GoogleNotificationDto } from '../../monetisation/dto/google-notification.dto';

describe('SanitiseHtmlPipe compatibility boundary', () => {
  let pipe: SanitiseHtmlPipe;
  const mockMetadata: ArgumentMetadata = { type: 'body' };

  beforeEach(() => {
    pipe = new SanitiseHtmlPipe();
  });

  it('exports SANITISATION_EXEMPT_FIELDS and alias SANITISATION_EXEMPT_KEYS', () => {
    expect(SANITISATION_EXEMPT_FIELDS).toBeDefined();
    expect(SANITISATION_EXEMPT_KEYS).toBe(SANITISATION_EXEMPT_FIELDS);
    expect(SANITISATION_EXEMPT_FIELDS.has('stack')).toBe(true);
    expect(SANITISATION_EXEMPT_FIELDS.has('componentStack')).toBe(true);
    expect(SANITISATION_EXEMPT_FIELDS.has('signedPayload')).toBe(true);
    expect(SANITISATION_EXEMPT_FIELDS.has('signedTransactionInfo')).toBe(true);
    expect(SANITISATION_EXEMPT_FIELDS.has('purchaseToken')).toBe(true);
  });

  it('exempts non-user-authored body field strings when parameter metadata specifies an exempt key', () => {
    const stackTrace =
      'TypeError: render<List<T>>()\n    at <anonymous> (app.component.ts:42:10)';
    expect(pipe.transform(stackTrace, { type: 'body', data: 'stack' })).toBe(
      stackTrace,
    );

    const componentStack = '<AppComponent>\n  at <anonymous>';
    expect(
      pipe.transform(componentStack, { type: 'body', data: 'componentStack' }),
    ).toBe(componentStack);

    const functionName = '<anonymous>';
    expect(
      pipe.transform(functionName, { type: 'body', data: 'functionName' }),
    ).toBe(functionName);

    const source = 'render<List<T>>()';
    expect(pipe.transform(source, { type: 'body', data: 'source' })).toBe(
      source,
    );

    const rawBody = '{"event":"<iap_event>"}';
    expect(pipe.transform(rawBody, { type: 'body', data: 'rawBody' })).toBe(
      rawBody,
    );

    const signedPayload = 'header.<apple-signed-data>.signature';
    expect(
      pipe.transform(signedPayload, { type: 'body', data: 'signedPayload' }),
    ).toBe(signedPayload);

    const signedTx = 'apple.<signedTransactionInfo<T>>.sig';
    expect(
      pipe.transform(signedTx, {
        type: 'body',
        data: 'signedTransactionInfo',
      }),
    ).toBe(signedTx);

    const purchaseToken = 'google-token-<sub-id>';
    expect(
      pipe.transform(purchaseToken, { type: 'body', data: 'purchaseToken' }),
    ).toBe(purchaseToken);

    const receiptData = 'base64<receipt-data>';
    expect(
      pipe.transform(receiptData, { type: 'body', data: 'receiptData' }),
    ).toBe(receiptData);

    const password = 'my<complex>password!';
    expect(pipe.transform(password, { type: 'body', data: 'password' })).toBe(
      password,
    );
  });

  it('exempts body strings when metatype is LogClientErrorDto, ClientErrorDto, AppleNotificationDto, or GoogleNotificationDto', () => {
    const stack =
      'TypeError: render<List<T>>()\n    at <anonymous> (app.component.ts:42:10)';
    expect(
      pipe.transform(stack, { type: 'body', metatype: LogClientErrorDto }),
    ).toBe(stack);
    expect(
      pipe.transform(stack, { type: 'body', metatype: ClientErrorDto }),
    ).toBe(stack);
    expect(
      pipe.transform(stack, { type: 'body', metatype: AppleNotificationDto }),
    ).toBe(stack);
    expect(
      pipe.transform(stack, { type: 'body', metatype: GoogleNotificationDto }),
    ).toBe(stack);
  });

  it('still sanitises non-exempt body fields when metadata indicates standard user input', () => {
    expect(
      pipe.transform('<b>user biography</b>', { type: 'body', data: 'bio' }),
    ).toBe('user biography');
    expect(
      pipe.transform('<script>alert("xss")</script>hello', {
        type: 'body',
        data: 'description',
      }),
    ).toBe('hello');
  });

  it('sanitises a directly supplied legacy rich-text string', () => {
    expect(pipe.transform('<b>bold</b>', mockMetadata)).toBe('bold');
    expect(pipe.transform('<script>alert("xss")</script>', mockMetadata)).toBe(
      '',
    );
  });

  it('does not recursively mutate plain request DTOs', () => {
    const payload = {
      message: 'TypeError: render<List<T>>() failed',
      profileText: '<b>literal user text</b>',
    };

    expect(pipe.transform(payload, mockMetadata)).toBe(payload);
    expect(payload.profileText).toBe('<b>literal user text</b>');
  });

  it('preserves client error stacks and stack-frame angle brackets exactly', () => {
    const payload = {
      message: 'Unhandled error',
      stack:
        'TypeError: render<List<T>>()\n    at <anonymous> (app.component.ts:42:10)',
      componentStack: '<AppComponent>\n  at <anonymous>',
      stackFrames: [
        {
          functionName: '<anonymous>',
          fileName: 'app.component.ts',
          source: 'render<List<T>>()',
        },
      ],
    };

    const result = pipe.transform(payload, mockMetadata);

    expect(result).toBe(payload);
    expect(payload.stack).toContain('<anonymous>');
    expect(payload.stack).toContain('List<T>');
    expect(payload.stackFrames[0].source).toBe('render<List<T>>()');
  });

  it('preserves provider-signed webhook payloads without parsing or rewriting', () => {
    const payload = {
      signedPayload: 'header.<signed-provider-data>.signature',
      apple: {
        signedTransactionInfo: 'a.<transaction<T>>.c',
      },
      google: {
        message: {
          data: 'eyJ0eXBlIjoiPGdlbmVyaWM8VD4+In0=',
        },
      },
    };

    expect(pipe.transform(payload, mockMetadata)).toBe(payload);
    expect(payload.signedPayload).toBe(
      'header.<signed-provider-data>.signature',
    );
    expect(payload.apple.signedTransactionInfo).toBe('a.<transaction<T>>.c');
  });

  it('returns arrays and non-string values unchanged', () => {
    const array = ['<b>literal</b>', '<anonymous>'];
    const buffer = Buffer.from('<signed>bytes</signed>');

    expect(pipe.transform(array, mockMetadata)).toBe(array);
    expect(pipe.transform(buffer, mockMetadata)).toBe(buffer);
    expect(pipe.transform(123, mockMetadata)).toBe(123);
    expect(pipe.transform(null, mockMetadata)).toBe(null);
    expect(pipe.transform(undefined, mockMetadata)).toBe(undefined);
  });
});
