import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientErrorDto } from './client-error.dto';

async function validatePayload(payload: Record<string, unknown>) {
  return validate(plainToInstance(ClientErrorDto, payload));
}

describe('ClientErrorDto', () => {
  it('accepts a bounded crash payload', async () => {
    const errors = await validatePayload({
      message: 'Render failed',
      name: 'TypeError',
      stack: 'TypeError: Render failed\n    at render (app.ts:12:3)',
      url: 'https://example.com/app',
      userAgent: 'Example Browser',
      metadata: { category: 'global' },
      stackFrames: [
        {
          fileName: 'app.ts',
          functionName: 'render',
          lineNumber: 12,
          columnNumber: 3,
        },
      ],
      timestamp: '2026-08-26T10:00:00.000Z',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects oversized messages, stacks and user-agent values', async () => {
    const errors = await validatePayload({
      message: 'm'.repeat(1001),
      stack: 's'.repeat(12001),
      userAgent: 'u'.repeat(513),
    });

    const properties = errors.map((error) => error.property);
    expect(properties).toEqual(
      expect.arrayContaining(['message', 'stack', 'userAgent']),
    );
  });

  it('rejects more than twenty stack frames', async () => {
    const errors = await validatePayload({
      message: 'Too many frames',
      stackFrames: Array.from({ length: 21 }, () => ({ fileName: 'app.ts' })),
    });

    expect(errors.some((error) => error.property === 'stackFrames')).toBe(true);
  });

  it('rejects invalid frame coordinates and timestamps', async () => {
    const errors = await validatePayload({
      message: 'Invalid shape',
      stackFrames: [{ lineNumber: -1, columnNumber: 10_000_001 }],
      timestamp: 'not-a-date',
    });

    expect(errors.some((error) => error.property === 'stackFrames')).toBe(true);
    expect(errors.some((error) => error.property === 'timestamp')).toBe(true);
  });
});
