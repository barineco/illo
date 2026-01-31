import { IsString, IsOptional, IsEnum, MaxLength, IsUrl } from 'class-validator'
import { Visibility } from '@prisma/client'

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility

  @IsOptional()
  @IsString()
  @IsUrl()
  coverImageUrl?: string
}
