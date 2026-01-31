export declare enum UserRole {
    ADMIN = "ADMIN",
    USER = "USER"
}
export interface User {
    id: string;
    username: string;
    email: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    coverImageUrl: string | null;
    role: UserRole;
    isActive: boolean;
    isVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface UserProfile {
    id: string;
    username: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    coverImageUrl: string | null;
    isVerified: boolean;
    createdAt: Date;
    followersCount: number;
    followingCount: number;
    artworksCount: number;
}
export interface CreateUserDto {
    username: string;
    email: string;
    password: string;
    displayName?: string;
}
export interface UpdateUserDto {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
}
export interface LoginDto {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: Omit<User, 'email'>;
    accessToken: string;
    refreshToken: string;
}
