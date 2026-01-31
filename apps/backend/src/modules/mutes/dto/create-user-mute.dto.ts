import { IsOptional, IsBoolean, IsNumber, Min } from 'class-validator'

export class CreateUserMuteDto {
  @IsOptional()
  @IsBoolean()
  muteNotifications?: boolean = true

  @IsOptional()
  @IsNumber()
  @Min(60) // Minimum 1 minute
  duration?: number // Duration in seconds, null = permanent
}
