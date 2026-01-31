import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator'

export class UpdateWordMuteDto {
  @IsOptional()
  @IsBoolean()
  regex?: boolean

  @IsOptional()
  @IsBoolean()
  wholeWord?: boolean

  @IsOptional()
  @IsBoolean()
  caseSensitive?: boolean

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  duration?: number // Duration in seconds, null = permanent
}
