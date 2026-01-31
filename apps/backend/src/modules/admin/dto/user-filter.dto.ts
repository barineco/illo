import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator'
import { Type } from 'class-transformer'

export class UserFilterDto {
  @IsOptional()
  @IsString()
  @IsIn(['all', 'pending', 'active', 'suspended', 'rejected'])
  status?: 'all' | 'pending' | 'active' | 'suspended' | 'rejected' = 'all'

  @IsOptional()
  @IsString()
  @IsIn(['all', 'local', 'remote'])
  location?: 'all' | 'local' | 'remote' = 'all'

  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20
}
