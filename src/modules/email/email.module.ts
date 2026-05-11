import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Global() // EmailService injectable everywhere without re-importing
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}