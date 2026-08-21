import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEscrowPayments20260807 implements MigrationInterface {
  name = 'CreateEscrowPayments20260807';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS escrow_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        payee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount_coins INTEGER NOT NULL CHECK (amount_coins > 0),
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'funded', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled')),
        description TEXT NOT NULL DEFAULT '',
        terms_locked BOOLEAN NOT NULL DEFAULT false,
        payer_approved BOOLEAN NOT NULL DEFAULT false,
        payee_approved BOOLEAN NOT NULL DEFAULT false,
        dispute_reason TEXT,
        dispute_resolved_by UUID REFERENCES users(id),
        refund_amount INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_escrow_payments_payer ON escrow_payments(payer_id);
      CREATE INDEX IF NOT EXISTS idx_escrow_payments_payee ON escrow_payments(payee_id);
      CREATE INDEX IF NOT EXISTS idx_escrow_payments_status ON escrow_payments(status);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS escrow_payments CASCADE');
  }
}
