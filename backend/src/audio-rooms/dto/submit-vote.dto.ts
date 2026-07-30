import { IsUUID, IsInt, Min } from 'class-validator';

export class SubmitVoteDto {
  @IsUUID()
  pollId!: string;

  @IsInt()
  @Min(0)
  optionIndex!: number;
}
