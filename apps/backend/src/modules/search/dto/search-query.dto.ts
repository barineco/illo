import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

export enum SearchType {
  ALL = 'all',
  USERS = 'users',
  ARTWORKS = 'artworks',
}

export class SearchQueryDto {
  @IsString()
  q: string

  @IsOptional()
  @IsEnum(SearchType)
  type?: SearchType = SearchType.ALL

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  includeRemote?: boolean = true
}

export class UserSearchQueryDto {
  @IsString()
  q: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10

  @IsOptional()
  includeRemote?: boolean = true
}

export class ResolveUserDto {
  @IsString()
  handle: string
}
