import { IsString, MinLength } from 'class-validator'

export class RejectUserDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string

  @IsString()
  @MinLength(1, { message: 'Reason is required' })
  reason: string
}
