import { ApiProperty } from '@nestjs/swagger';
import type { LinkPreview } from '../interfaces/link-preview.interface';

/**
 * OpenGraph link preview response DTO.
 */
export class LinkPreviewResponseDto implements LinkPreview {
  @ApiProperty({
    description: 'The requested absolute URL.',
    example: 'https://example.com/article',
  })
  url!: string;

  @ApiProperty({
    description:
      'The sanitised title extracted from OpenGraph or document title.',
    example: 'Great Article',
  })
  title!: string;

  @ApiProperty({
    description:
      'The sanitised description extracted from OpenGraph or description meta tag.',
    example: 'A description',
  })
  description!: string;

  @ApiProperty({
    description: 'The sanitised absolute image URL extracted from OpenGraph.',
    example: 'https://example.com/img/cover.png',
  })
  image!: string;

  @ApiProperty({
    description:
      'The site or publisher name extracted from OpenGraph or hostname.',
    example: 'Example',
  })
  siteName!: string;
}
