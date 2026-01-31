import { ref, computed } from 'vue'
import {
  EMOJI_CATEGORIES,
  DEFAULT_QUICK_REACTIONS,
  searchEmojis,
  type EmojiCategory,
} from '~/data/emoji/emoji-data'

export interface EmojiItem {
  shortcode: string
  emoji: string
  type: 'unicode' | 'recent'
}

export interface EmojiSection {
  id: string
  title: string
  icon: string
  emojis: EmojiItem[]
}

const MAX_RECENT_EMOJIS = 20
const RECENT_EMOJIS_KEY = 'reaction-recent-emojis'

export function useEmoji() {
  const recentEmojis = ref<string[]>([])

  const initRecentEmojis = () => {
    if (import.meta.client) {
      try {
        const stored = localStorage.getItem(RECENT_EMOJIS_KEY)
        if (stored) {
          recentEmojis.value = JSON.parse(stored)
        }
      } catch {
        recentEmojis.value = []
      }
    }
  }

  const saveRecentEmojis = () => {
    if (import.meta.client) {
      try {
        localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recentEmojis.value))
      } catch {
        // Ignore storage errors
      }
    }
  }

  const recordEmojiUsage = (emoji: string) => {
    const index = recentEmojis.value.indexOf(emoji)
    if (index > -1) {
      recentEmojis.value.splice(index, 1)
    }

    recentEmojis.value.unshift(emoji)

    if (recentEmojis.value.length > MAX_RECENT_EMOJIS) {
      recentEmojis.value = recentEmojis.value.slice(0, MAX_RECENT_EMOJIS)
    }

    saveRecentEmojis()
  }

  const quickReactions = computed<EmojiItem[]>(() => {
    return DEFAULT_QUICK_REACTIONS.map(emoji => ({
      shortcode: emoji,
      emoji,
      type: 'unicode' as const,
    }))
  })

  const pickerSections = computed<EmojiSection[]>(() => {
    const sections: EmojiSection[] = []

    if (recentEmojis.value.length > 0) {
      sections.push({
        id: 'recent',
        title: '最近使用',
        icon: '🕐',
        emojis: recentEmojis.value.map(emoji => ({
          shortcode: emoji,
          emoji,
          type: 'recent' as const,
        })),
      })
    }

    for (const category of EMOJI_CATEGORIES) {
      sections.push({
        id: category.id,
        title: category.name,
        icon: category.icon,
        emojis: category.emojis.map(emoji => ({
          shortcode: emoji,
          emoji,
          type: 'unicode' as const,
        })),
      })
    }

    return sections
  })

  const search = (query: string): EmojiItem[] => {
    if (!query.trim()) return []

    const results = searchEmojis(query)
    return results.map(emoji => ({
      shortcode: emoji,
      emoji,
      type: 'unicode' as const,
    }))
  }

  const categories = computed<Array<{ id: string; name: string; icon: string }>>(() => {
    const cats = [
      { id: 'recent', name: '最近使用', icon: '🕐' },
      ...EMOJI_CATEGORIES.map(c => ({ id: c.id, name: c.name, icon: c.icon })),
    ]
    if (recentEmojis.value.length === 0) {
      return cats.filter(c => c.id !== 'recent')
    }
    return cats
  })

  if (import.meta.client) {
    initRecentEmojis()
  }

  return {
    recentEmojis,
    quickReactions,
    pickerSections,
    categories,
    recordEmojiUsage,
    search,
    initRecentEmojis,
  }
}
