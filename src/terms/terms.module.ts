import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationModule } from '../automation/automation.module';
import { Session } from './entities/session.entity';
import { Term } from './entities/term.entity';
import { TermsService } from './terms.service';
import { TermsResolver } from './terms.resolver';

@Module({
  imports: [AutomationModule, TypeOrmModule.forFeature([Session, Term])],
  providers: [TermsService, TermsResolver],
  exports: [TermsService],
})
export class TermsModule {}
