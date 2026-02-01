import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator'

const EMOJI_PATTERN =
  /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji}(?:\u200D\p{Emoji})+)+$/u

export class CreateReactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  @Matches(EMOJI_PATTERN, {
    message: 'emoji must be a valid Unicode emoji',
  })
  emoji: string
}
