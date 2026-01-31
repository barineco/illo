import { PrismaClient } from '@prisma/client'
import * as crypto from 'crypto'

// EncryptionService のロジックをコピー（DIなしで実行するため）
class EncryptionHelper {
  private readonly algorithm = 'aes-256-gcm'
  private readonly ivLength = 16
  private readonly encryptionKey: Buffer

  constructor(keyHex: string) {
    if (!keyHex || keyHex.length !== 64) {
      throw new Error('Invalid encryption key')
    }
    this.encryptionKey = Buffer.from(keyHex, 'hex')
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.ivLength)
    const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv)

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64')
    ciphertext += cipher.final('base64')

    const authTag = cipher.getAuthTag()

    return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`
  }

  // 暗号化済みかチェック（暗号化形式は "base64:base64:base64"）
  isEncrypted(value: string): boolean {
    const parts = value.split(':')
    return parts.length === 3
  }
}

async function main() {
  const prisma = new PrismaClient()
  const encryptionKey = process.env.ENCRYPTION_KEY

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY environment variable is required')
  }

  const encryption = new EncryptionHelper(encryptionKey)

  // 2FAが有効なすべてのユーザーを取得
  const users = await prisma.user.findMany({
    where: {
      twoFactorEnabled: true,
      twoFactorSecret: {
        not: null,
      },
    },
  })

  console.log(`Found ${users.length} users with 2FA enabled`)

  let migratedCount = 0
  let alreadyEncryptedCount = 0

  for (const user of users) {
    if (!user.twoFactorSecret) continue

    // 既に暗号化済みかチェック
    if (encryption.isEncrypted(user.twoFactorSecret)) {
      console.log(`User ${user.username} (${user.id}): Already encrypted`)
      alreadyEncryptedCount++
      continue
    }

    // 平文secretを暗号化
    try {
      const encryptedSecret = encryption.encrypt(user.twoFactorSecret)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: encryptedSecret,
        },
      })

      console.log(`User ${user.username} (${user.id}): Migrated successfully`)
      migratedCount++
    } catch (error) {
      console.error(
        `User ${user.username} (${user.id}): Migration failed - ${error.message}`,
      )
    }
  }

  console.log('\nMigration Summary:')
  console.log(`- Total users: ${users.length}`)
  console.log(`- Migrated: ${migratedCount}`)
  console.log(`- Already encrypted: ${alreadyEncryptedCount}`)
  console.log(
    `- Failed: ${users.length - migratedCount - alreadyEncryptedCount}`,
  )

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
