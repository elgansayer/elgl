import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyDmcaNoticeDto {
  @ApiProperty({ description: 'Single-use token from the confirmation email.' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/, { message: 'token is not valid' })
  token!: string;
}
