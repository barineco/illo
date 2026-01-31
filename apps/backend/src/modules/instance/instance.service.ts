import { Injectable } from '@nestjs/common'

export interface InstanceContactInfo {
  contactInfo: string | null
  adminUsername: string | null
}

@Injectable()
export class InstanceService {
  getContactInfo(): InstanceContactInfo {
    return {
      contactInfo: process.env.INSTANCE_CONTACT_INFO || null,
      adminUsername: process.env.INSTANCE_ADMIN_USERNAME || null,
    }
  }
}
