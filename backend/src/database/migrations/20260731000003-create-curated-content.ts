import { MigrationInterface, QueryRunner } from 'typeorm';

// Audit: this migration introduces no foreign keys, so no extra indexes required.
export class CreateCuratedContent20260731000003 implements MigrationInterface {
  name = 'CreateCuratedContent20260731000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS curated_articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        language TEXT NOT NULL,
        content_text TEXT NOT NULL,
        word_count INTEGER NOT NULL DEFAULT 0,
        difficulty_rating INTEGER NOT NULL DEFAULT 1,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS curated_dialogues (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        cefr_level TEXT NOT NULL,
        language TEXT NOT NULL,
        lines JSONB NOT NULL DEFAULT '[]'::jsonb,
        tags TEXT[] NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_curated_articles_cefr_language
        ON curated_articles (cefr_level, language);
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_curated_dialogues_cefr_language
        ON curated_dialogues (cefr_level, language);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS curated_dialogues;`);
    await queryRunner.query(`DROP TABLE IF EXISTS curated_articles;`);
  }
}
