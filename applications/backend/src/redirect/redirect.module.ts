import { Module } from '@nestjs/common';
import { RedirectService } from './redirect.service';
import { RedirectController } from './redirect.controller';

@Module({
  controllers: [RedirectController],
  providers: [RedirectService],
})
export class RedirectModule {}
