// Instance mode enum (matches Prisma schema)
export enum InstanceMode {
  PERSONAL = 'PERSONAL',           // 個人用: adminユーザーページがホーム
  FEDERATION_ONLY = 'FEDERATION_ONLY', // illo連合のみ
  FULL_FEDIVERSE = 'FULL_FEDIVERSE',  // フルFediverse連合（将来用）
}

// Instance settings entity
export interface InstanceSettings {
  id: string
  instanceName: string
  instanceMode: InstanceMode
  isSetupComplete: boolean
  adminUserId: string | null
  allowRegistration: boolean
  requireApproval: boolean
  publicUrl: string | null
  allowSearchEngineIndexing: boolean
  description: string | null
  createdAt: Date
  updatedAt: Date
}

// DTO for initial setup
export interface InitialSetupDto {
  instanceName: string
  instanceMode: InstanceMode
  publicUrl: string // Public-facing URL (e.g., https://example.com)
  adminUsername: string
  adminEmail: string
  adminPassword: string
  adminDisplayName?: string
  description?: string
}

// DTO for updating instance settings
export interface UpdateInstanceSettingsDto {
  instanceName?: string
  instanceMode?: InstanceMode
  publicUrl?: string
  allowRegistration?: boolean
  requireApproval?: boolean
  allowSearchEngineIndexing?: boolean
  description?: string
}

// Public instance info (for federation and public pages)
export interface PublicInstanceInfo {
  instanceName: string
  instanceMode: InstanceMode
  description: string | null
  allowRegistration: boolean
  requireApproval: boolean
  allowSearchEngineIndexing: boolean
}
