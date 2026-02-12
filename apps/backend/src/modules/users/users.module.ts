import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'
import { PrismaModule } from '../prisma/prisma.module'
import { StorageModule } from '../storage/storage.module'
import { FederationModule } from '../federation/federation.module'
import { OCsModule } from '../ocs/ocs.module'

@Module({
  imports: [
    PrismaModule,
    StorageModule,
    forwardRef(() => FederationModule),
    OCsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
