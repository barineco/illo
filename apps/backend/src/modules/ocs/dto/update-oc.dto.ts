import {
  IsString,
  IsOptional,
  MaxLength,
  IsBoolean,
  IsEnum,
  IsArray,
} from 'class-validator'
import { FanArtPermission, Visibility } from '@prisma/client'

export class UpdateOCDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  description?: string

  // Representative artwork (for avatar/thumbnail) - null to remove
  @IsString()
  @IsOptional()
  representativeArtworkId?: string | null

  // Fan art permission settings
  @IsBoolean()
  @IsOptional()
  allowFanArt?: boolean

  @IsEnum(FanArtPermission)
  @IsOptional()
  fanArtPermission?: FanArtPermission

  // Guidelines
  @IsBoolean()
  @IsOptional()
  allowR18?: boolean

  @IsBoolean()
  @IsOptional()
  allowCommercial?: boolean

  @IsBoolean()
  @IsOptional()
  requireCredit?: boolean

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  guidelines?: string

  // Reference materials
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  referenceNotes?: string

  @IsEnum(Visibility)
  @IsOptional()
  referenceVisibility?: Visibility

  // Tags
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[]
}
