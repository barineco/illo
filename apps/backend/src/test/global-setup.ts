import { execSync } from 'child_process'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://illo_test:illo_test@localhost:5433/illo_test'

export async function setup() {
  const databaseUrl = process.env.DATABASE_URL || DEFAULT_TEST_DATABASE_URL

  const backendRoot = path.resolve(__dirname, '../..')

  execSync('npx prisma migrate deploy', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  })

  prisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  })

  await prisma.$queryRaw`SELECT 1`
}

export async function teardown() {
  if (prisma) {
    await prisma.$disconnect()
  }
}
