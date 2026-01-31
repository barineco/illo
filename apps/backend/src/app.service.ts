import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AppService {
  private readonly instanceName: string

  constructor(private configService: ConfigService) {
    this.instanceName = this.configService.get<string>('INSTANCE_NAME', 'illo')
  }

  getHello(): string {
    return `${this.instanceName} API is running`
  }
}
