import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUrl, MaxLength } from 'class-validator';

/**
 * Validated query parameters for the OpenGraph link preview scraper endpoint.
 */
export class LinkPreviewQueryDto {
  @ApiProperty({
    description: 'The absolute http(s) URL to scrape for OpenGraph metadata.',
    example: 'https://example.com/article',
  })
  @IsString()
  @IsNotEmpty({ message: 'Missing url query parameter' })
  @MaxLength(2048, { message: 'URL is too long' })
  @IsUrl(
    {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
    },
    { message: 'url must be a valid http or https URL' },
  )
  url!: string;
}
