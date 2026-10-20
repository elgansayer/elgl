import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientErrorDto } from './client-error.dto';

async function errorsFor(input: Record<string, unknown>) {
  return validate(plainToInstance(ClientErrorDto, input));
}

describe('ClientErrorDto', () => {
  it('accepts a bounded crash report', async () => {
    await expect(
      errorsFor({
        message: 'boom',
        name: 'TypeError',
        stackFrames: [{ fileName: 'app.ts', lineNumber: 10, columnNumber: 2 }],
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects oversized messages and stack traces', async () => {
    const errors = await errorsFor({
      message: 'm'.repeat(1001),
      stack: 's'.repeat(12001),
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['message', 'stack']),
    );
  });

  it('rejects more than 30 stack frames', async () => {
    const errors = await errorsFor({
      message: 'boom',
      stackFrames: Array.from({ length: 31 }, () => ({ fileName: 'app.ts' })),
    });

    expect(errors.some((error) => error.property === 'stackFrames')).toBe(true);
  });

  it('rejects invalid stack-frame coordinates', async () => {
    const errors = await errorsFor({
      message: 'boom',
      stackFrames: [{ fileName: 'app.ts', lineNumber: -1, columnNumber: 100001 }],
    });

    expect(errors.some((error) => error.property === 'stackFrames')).toBe(true);
  });
});
