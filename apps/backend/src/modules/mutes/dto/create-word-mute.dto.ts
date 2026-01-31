import { IsString, IsOptional, IsBoolean, IsNumber, Min, MaxLength } from 'class-validator'

export class CreateWordMuteDto {
  @IsString()
  @MaxLength(255)
  keyword: string

  @IsOptional()
  @IsBoolean()
  regex?: boolean = false

  @IsOptional()
  @IsBoolean()
  wholeWord?: boolean = false

  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean = false

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  duration?: number // Duration in seconds, null = permanent
}
