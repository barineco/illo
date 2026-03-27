// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt({
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/unified-signatures': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/return-in-computed-property': 'warn',
    'no-useless-catch': 'warn',
  },
})
