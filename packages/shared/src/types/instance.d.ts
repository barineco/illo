export declare enum InstanceMode {
    PERSONAL = "PERSONAL",
    FEDERATION_ONLY = "FEDERATION_ONLY",
    FULL_FEDIVERSE = "FULL_FEDIVERSE"
}
export interface InstanceSettings {
    id: string;
    instanceName: string;
    instanceMode: InstanceMode;
    isSetupComplete: boolean;
    adminUserId: string | null;
    allowRegistration: boolean;
    requireApproval: boolean;
    publicUrl: string | null;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export interface InitialSetupDto {
    instanceName: string;
    instanceMode: InstanceMode;
    publicUrl: string;
    adminUsername: string;
    adminEmail: string;
    adminPassword: string;
    adminDisplayName?: string;
    description?: string;
}
export interface UpdateInstanceSettingsDto {
    instanceName?: string;
    instanceMode?: InstanceMode;
    publicUrl?: string;
    allowRegistration?: boolean;
    requireApproval?: boolean;
    description?: string;
}
export interface PublicInstanceInfo {
    instanceName: string;
    instanceMode: InstanceMode;
    description: string | null;
    allowRegistration: boolean;
    requireApproval: boolean;
}
