import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { LinksModule } from './links/links.module';
import { RedirectModule } from './redirect/redirect.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    LinksModule,
    RedirectModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
