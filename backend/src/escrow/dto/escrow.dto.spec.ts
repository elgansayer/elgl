import { validate } from 'class-validator';
import {
  CreateEscrowHoldDto,
  ReleaseEscrowDto,
  RefundEscrowDto,
  CancelEscrowDto,
} from './escrow.dto';

describe('Escrow DTOs', () => {
  describe('CreateEscrowHoldDto', () => {
    it('should accept a fully valid DTO', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 50;
      dto.reason = 'Lesson payment';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept a valid DTO with optional metadata', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 100;
      dto.reason = 'Translation service';
      dto.metadata = { lessonId: 'abc', language: 'de' };

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when payee_id is missing', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.amount_coins = 50;
      dto.reason = 'Missing payee';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'payee_id')).toBe(true);
    });

    it('should fail when payee_id is not a string', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = 12345;
      dto.amount_coins = 50;
      dto.reason = 'Invalid payee type';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'payee_id')).toBe(true);
    });

    it('should fail when amount_coins is missing', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.reason = 'No amount';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount_coins')).toBe(true);
    });

    it('should fail when amount_coins is zero', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 0;
      dto.reason = 'Zero coins';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount_coins')).toBe(true);
    });

    it('should fail when amount_coins is negative', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = -10;
      dto.reason = 'Negative coins';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount_coins')).toBe(true);
    });

    it('should fail when amount_coins is not an integer', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 99.99;
      dto.reason = 'Float amount';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'amount_coins')).toBe(true);
    });

    it('should fail when reason is missing', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 50;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });

    it('should fail when reason exceeds 500 characters', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 50;
      dto.reason = 'x'.repeat(501);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });

    it('should accept reason at exactly 500 characters', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 50;
      dto.reason = 'x'.repeat(500);

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when metadata is not an object', async () => {
      const dto = new CreateEscrowHoldDto();
      dto.payee_id = '87654321-4321-4321-4321-210987654321';
      dto.amount_coins = 50;
      dto.reason = 'Bad metadata';
      dto.metadata = 'not-an-object';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'metadata')).toBe(true);
    });
  });

  describe('ReleaseEscrowDto', () => {
    it('should accept a valid DTO', async () => {
      const dto = new ReleaseEscrowDto();
      dto.transaction_id = '99999999-9999-9999-9999-999999999999';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when transaction_id is missing', async () => {
      const dto = new ReleaseEscrowDto();

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
    });

    it('should fail when transaction_id is not a string', async () => {
      const dto = new ReleaseEscrowDto();
      dto.transaction_id = 12345 as unknown as string;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
    });
  });

  describe('RefundEscrowDto', () => {
    it('should accept a valid DTO with reason', async () => {
      const dto = new RefundEscrowDto();
      dto.transaction_id = '99999999-9999-9999-9999-999999999999';
      dto.reason = 'Service not delivered';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should accept a valid DTO without reason', async () => {
      const dto = new RefundEscrowDto();
      dto.transaction_id = '99999999-9999-9999-9999-999999999999';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when transaction_id is missing', async () => {
      const dto = new RefundEscrowDto();
      dto.reason = 'Changed mind';

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
    });

    it('should fail when reason exceeds 500 characters', async () => {
      const dto = new RefundEscrowDto();
      dto.transaction_id = '99999999-9999-9999-9999-999999999999';
      dto.reason = 'x'.repeat(501);

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'reason')).toBe(true);
    });
  });

  describe('CancelEscrowDto', () => {
    it('should accept a valid DTO', async () => {
      const dto = new CancelEscrowDto();
      dto.transaction_id = '99999999-9999-9999-9999-999999999999';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when transaction_id is missing', async () => {
      const dto = new CancelEscrowDto();

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
    });

    it('should fail when transaction_id is not a string', async () => {
      const dto = new CancelEscrowDto();
      dto.transaction_id = null as unknown as string;

      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'transaction_id')).toBe(true);
    });
  });
});
