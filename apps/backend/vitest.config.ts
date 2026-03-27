import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          root: './',
          include: ['src/**/*.spec.ts'],
          exclude: ['src/**/*.integration.spec.ts'],
          coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
              'src/**/*.spec.ts',
              'src/**/*.integration.spec.ts',
              'src/**/*.module.ts',
              'src/**/*.dto.ts',
              'src/**/*.entity.ts',
              'src/main.ts',
            ],
          },
        },
      },
      {
        plugins: [swc.vite()],
        test: {
          name: 'integration',
          globals: true,
          root: './',
          include: ['src/**/*.integration.spec.ts'],
          globalSetup: ['src/test/global-setup.ts'],
          env: {
            DATABASE_URL:
              'postgresql://illo_test:illo_test@localhost:5433/illo_test',
            JWT_SECRET: 'test-jwt-secret-key',
            JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key',
            INSTANCE_URL: 'http://localhost:3000',
            FRONTEND_URL: 'http://localhost:3000',
            INSTANCE_NAME: 'illo-test',
            BASE_URL: 'http://localhost:3000',
            ENCRYPTION_KEY:
              'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          },
          fileParallelism: false,
          sequence: {
            concurrent: false,
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
