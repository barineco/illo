import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class RequestEmailChangeDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string

  @IsString()
  @IsOptional()
  password?: string
}
