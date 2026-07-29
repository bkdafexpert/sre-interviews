import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateLinkDto {
  @ApiProperty({ description: 'true = activate the link, false = deactivate it' })
  @IsBoolean()
  active: boolean;
}

export class CreateLinkDto {
  @ApiProperty({
    description: 'Destination URL (must include http/https)',
    example: 'https://example.com',
  })
  @IsUrl({ require_protocol: true }, { message: 'destination must be a valid URL (including http/https)' })
  destination: string;

  // null / omitted => the link never expires.
  @ApiPropertyOptional({
    description: 'Days until the link expires; omit for a link that never expires',
    minimum: 1,
    maximum: 3650,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  expiresInDays?: number;
}

export class ListLinksDto {
  @ApiPropertyOptional({ description: 'Free-text search over code and destination' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ description: 'Filter set', enum: ['tous', 'actifs', 'expires'] })
  @IsOptional()
  @IsString()
  filter?: 'tous' | 'actifs' | 'expires';

  @ApiPropertyOptional({ description: 'Number of items to skip (offset)', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ description: 'Page size', minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  take?: number;
}
