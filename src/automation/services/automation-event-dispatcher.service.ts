import { Injectable } from '@nestjs/common';
import { AutomationEventType } from '../enums/automation-event.enums';
import { AutomationOutboxEvent } from '../entities/automation-outbox-event.entity';

export type AutomationEventHandler = (
  event: AutomationOutboxEvent,
) => Promise<void> | void;

@Injectable()
export class AutomationEventDispatcher {
  private readonly handlers = new Map<
    AutomationEventType,
    Set<AutomationEventHandler>
  >();

  register = (
    types: AutomationEventType[],
    handler: AutomationEventHandler,
  ): void => {
    for (const type of types) {
      const handlers = this.handlers.get(type) ?? new Set();
      handlers.add(handler);
      this.handlers.set(type, handlers);
    }
  };

  dispatch = async (event: AutomationOutboxEvent): Promise<void> => {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;
    for (const handler of handlers) {
      await handler(event);
    }
  };
}
