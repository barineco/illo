import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator'
import { Visibility } from '@prisma/client'

export class CreateCollectionDto {
  @IsString()
  @MaxLength(100)
  title: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string

  @IsOptional()
  @IsEnum(Visibility)
  visibility?: Visibility
}
