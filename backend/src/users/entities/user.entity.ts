import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', nullable: true })
  @Index()
  display_name!: string | null;

  @Column({ type: 'varchar', length: 2, nullable: true })
  @Index()
  native_languages!: string[];

  @Column('text', { array: true, nullable: true })
  target_languages!: string[] | null;

  @Column({ type: 'text', nullable: true })
  bio_text!: string | null;

  @Column({ type: 'text', nullable: true })
  avatar_url!: string | null;

  @Column({ type: 'text', nullable: true })
  audio_intro_url!: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  primary_accent_color!: string | null;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: unknown;

  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  mock_location!: unknown;

  @Column({ type: 'text', nullable: true })
  mock_country!: string | null;

  @Column({ type: 'text', nullable: true })
  mock_city!: string | null;

  @Column({ type: 'boolean', default: false })
  @Index()
  is_vip!: boolean;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'free',
  })
  vip_tier!: string;

  @Column({ type: 'integer', default: 0 })
  coins_balance!: number;

  @Column({ type: 'integer', default: 1 })
  study_streak_days!: number;

  @Column({ type: 'float', default: 1.0 })
  correction_ratio!: number;

  @Column({
    type: 'boolean',
    generatedType: 'STORED',
    asExpression: '(study_streak_days > 7 AND correction_ratio >= 0.8)',
  })
  is_serious_learner!: boolean;

  @Column({ type: 'boolean', default: false })
  privacy_hide_age!: boolean;

  @Column({ type: 'boolean', default: false })
  privacy_hide_location!: boolean;

  @Column({ type: 'boolean', default: false })
  privacy_hide_from_search!: boolean;

  @Column({ type: 'boolean', default: false })
  matchmaking_consent!: boolean;

  @Column({ type: 'boolean', default: false })
  incognito_visits!: boolean;

  @Column({ type: 'varchar', length: 2, nullable: true })
  proficiency_level!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  interests!: string[] | null;

  @CreateDateColumn({ type: 'timestamptz', default: () => 'NOW()' })
  created_at!: Date;
}
