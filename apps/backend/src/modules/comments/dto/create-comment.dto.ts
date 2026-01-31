import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string

  @IsString()
  @IsOptional()
  parentId?: string
}
