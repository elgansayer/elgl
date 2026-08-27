import { IsString, Length, Matches } from 'class-validator';

export class FollowHashtagDto {
  @IsString()
  @Length(1, 51)
  @Matches(/^#?[\p{L}\p{N}_]+$/u, {
    message: 'hashtag may only contain letters, numbers, and underscores',
  })
  hashtag!: string;
}
