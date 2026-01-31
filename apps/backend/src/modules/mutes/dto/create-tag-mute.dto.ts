import { IsOptional, IsNumber, Min } from 'class-validator'

export class CreateTagMuteDto {
  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  duration?: number // Duration in seconds, null = permanent
}
