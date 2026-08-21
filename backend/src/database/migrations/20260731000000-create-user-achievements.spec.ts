import type { Mock } from 'vitest';
import { CreateUserAchievementsSchema20260731000000 } from './20260731000000-create-user-achievements';
import { QueryRunner } from 'typeorm';

describe('CreateUserAchievementsSchema20260731000000', () => {
  let migration: CreateUserAchievementsSchema20260731000000;
  let queryRunner: { query: Mock };

  beforeEach(() => {
    migration = new CreateUserAchievementsSchema20260731000000();
    queryRunner = {
      query: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('should run up migration', async () => {
    await migration.up(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS achievements'),
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS user_achievements'),
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id',
      ),
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(
        'CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id',
      ),
    );
  });

  it('should run down migration', async () => {
    await migration.down(queryRunner as unknown as QueryRunner);

    expect(queryRunner.query).toHaveBeenCalledTimes(2);
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('DROP TABLE IF EXISTS user_achievements'),
    );
    expect(queryRunner.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('DROP TABLE IF EXISTS achievements'),
    );
  });
});
