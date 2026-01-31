import { IsString, MinLength } from 'class-validator'

export class VerifyAdminPasswordDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string
}
