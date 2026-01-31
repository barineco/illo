import { IsString, MinLength } from 'class-validator'

export class SuspendUserDto {
  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password: string

  @IsString()
  @MinLength(1, { message: 'Reason is required' })
  reason: string
}
