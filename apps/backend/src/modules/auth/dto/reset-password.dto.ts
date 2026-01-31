import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator'

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(32, { message: 'Invalid reset token' })
  token: string

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword: string
}
