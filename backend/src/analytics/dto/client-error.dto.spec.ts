import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientErrorDto, LogClientErrorDto } from './client-error.dto';

async function errorsFor(input: Record<string, unknown>) {
  return validate(plainToInstance(ClientErrorDto, input));
}

describe('ClientErrorDto', () => {
  it('exports LogClientErrorDto as an alias for ClientErrorDto', () => {
    expect(LogClientErrorDto).toBe(ClientErrorDto);
  });

  it('accepts and validates LogClientErrorDto with angle brackets in stack and frame source', async () => {
    const report: LogClientErrorDto = {
      message: 'TypeError: render<List<T>>() failed',
      name: 'TypeError',
      stack:
        'TypeError: render<List<T>>()\n    at <anonymous> (app.component.ts:42:10)',
      componentStack: '<AppComponent>\n    at <anonymous>',
      stackFrames: [
        {
          functionName: '<anonymous>',
          fileName: 'app.component.ts',
          source: 'render<List<T>>()',
          lineNumber: 42,
          columnNumber: 10,
        },
      ],
    };

    const errors = await validate(plainToInstance(LogClientErrorDto, report));
    expect(errors).toHaveLength(0);
  });

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
      stackFrames: [
        { fileName: 'app.ts', lineNumber: -1, columnNumber: 100001 },
      ],
    });

    expect(errors.some((error) => error.property === 'stackFrames')).toBe(true);
  });
});
