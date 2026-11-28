import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationOutboxEvent } from './entities/automation-outbox-event.entity';
import { AutomationEventDispatcher } from './services/automation-event-dispatcher.service';
import { AutomationOutboxService } from './services/automation-outbox.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AutomationOutboxEvent])],
  providers: [AutomationEventDispatcher, AutomationOutboxService],
  exports: [AutomationEventDispatcher, AutomationOutboxService],
})
export class AutomationModule {}
