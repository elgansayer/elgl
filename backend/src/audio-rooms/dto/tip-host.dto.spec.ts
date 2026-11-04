import { validate } from 'class-validator';
import { TipHostDto } from './tip-host.dto';

function validDto(): TipHostDto {
  const dto = new TipHostDto();
  dto.room_id = '63eedbd6-03f9-433f-a481-98227dfd62af';
  dto.amount_coins = 50;
  dto.idempotency_key = '7a28776a-93f9-4c0e-b1bc-d47d02a9ca12';
  return dto;
}

describe('TipHostDto', () => {
  it('accepts a positive integer amount and UUID idempotency key', async () => {
    await expect(validate(validDto())).resolves.toHaveLength(0);
  });

  it('keeps the idempotency key optional for mixed-version clients', async () => {
    const dto = validDto();
    dto.idempotency_key = undefined;

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it.each([0, -1, 1.5])('rejects invalid coin amount %s', async (amount) => {
    const dto = validDto();
    dto.amount_coins = amount;

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'amount_coins')).toBe(
      true,
    );
  });

  it('rejects a malformed idempotency key', async () => {
    const dto = validDto();
    dto.idempotency_key = 'retry-me';

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'idempotency_key')).toBe(
      true,
    );
  });

  it('rejects a malformed room ID before it reaches PostgreSQL', async () => {
    const dto = validDto();
    dto.room_id = 'room-1';

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'room_id')).toBe(true);
  });
});
