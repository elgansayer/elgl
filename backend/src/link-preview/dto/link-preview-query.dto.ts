import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LinkPreviewQueryDto {
  @ApiProperty({
    name: 'url',
    required: true,
    description:
      'The absolute http(s) URL to scrape for link preview metadata.',
    example: 'https://example.com/article',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  url!: string;
}
