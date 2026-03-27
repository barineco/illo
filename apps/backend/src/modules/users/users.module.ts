import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { PrismaModule } from '../prisma/prisma.module'
import { StorageModule } from '../storage/storage.module'
import { MailModule } from '../mail/mail.module'
import { FederationModule } from '../federation/federation.module'
@Module({
  imports: [
    PrismaModule,
    StorageModule,
    MailModule,
    forwardRef(() => FederationModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
