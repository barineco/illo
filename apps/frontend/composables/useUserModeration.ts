import { ref } from 'vue'
import { useApi } from './useApi'

export interface UserModerationFilters {
  status?: 'all' | 'pending' | 'active' | 'suspended' | 'rejected'
  location?: 'all' | 'local' | 'remote'
  search?: string
  page?: number
  limit?: number
}

export interface UserInfo {
  id: string
  username: string
  domain?: string
  email: string
  displayName?: string
  bio?: string
  avatarUrl?: string
  role: string
  isActive: boolean
  isVerified: boolean
  approvedAt?: string
  approvedBy?: string
  rejectedAt?: string
  rejectionReason?: string
  suspendedAt?: string
  suspensionReason?: string
  deactivatedAt?: string
  deactivationReason?: string
  supporterTier?: 'NONE' | 'TIER_1' | 'TIER_2' | 'TIER_3'
  createdAt: string
  artworks?: Array<{
    id: string
    title: string
    images?: Array<{
      id?: string
      thumbnailUrl: string
    }>
  }>
  _count?: {
    artworks: number
    followers: number
    following: number
  }
}

export interface UserListResponse {
  users: UserInfo[]
  total: number
  page: number
  totalPages: number
}

export const useUserModeration = () => {
  const api = useApi()
  const loading = ref(false)
  const error = ref<string | null>(null)

  const getAllUsers = async (filters: UserModerationFilters = {}): Promise<UserListResponse> => {
    loading.value = true
    error.value = null

    try {
      const response = await api.get<UserListResponse>('/api/admin/users', { params: filters })
      return response
    } catch (err: any) {
      error.value = err.message || 'ユーザーの取得に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  const approveUser = async (userId: string, password: string): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      await api.post(`/api/admin/users/${userId}/approve`, { password })
    } catch (err: any) {
      error.value = err.message || 'ユーザーの承認に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  const rejectUser = async (userId: string, password: string, reason: string): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      await api.post(`/api/admin/users/${userId}/reject`, { password, reason })
    } catch (err: any) {
      error.value = err.message || 'ユーザーの拒否に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  const suspendUser = async (userId: string, password: string, reason: string): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      await api.post(`/api/admin/users/${userId}/suspend`, { password, reason })
    } catch (err: any) {
      error.value = err.message || 'ユーザーの停止に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  const activateUser = async (userId: string, password: string): Promise<void> => {
    loading.value = true
    error.value = null

    try {
      await api.post(`/api/admin/users/${userId}/activate`, { password })
    } catch (err: any) {
      error.value = err.message || 'ユーザーのアクティブ化に失敗しました'
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    error,
    getAllUsers,
    approveUser,
    rejectUser,
    suspendUser,
    activateUser,
  }
}
