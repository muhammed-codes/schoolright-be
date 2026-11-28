import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session } from './entities/session.entity';
import { Term } from './entities/term.entity';
import { CreateSessionInput } from './dto/create-session.input';
import { CreateTermInput } from './dto/create-term.input';
import { TermStatus } from '../common/enums';
import { AutomationEventType } from '../automation/enums/automation-event.enums';
import { AutomationOutboxService } from '../automation/services/automation-outbox.service';

export interface ActiveTermResolution {
  term: Term | null;
  reason?: string;
}

@Injectable()
export class TermsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionsRepository: Repository<Session>,
    @InjectRepository(Term)
    private readonly termsRepository: Repository<Term>,
    @Optional() private readonly automationOutbox?: AutomationOutboxService,
  ) {}

  private emitAutomationEvent = async (
    termId: string,
    schoolId: string,
    reason: string,
  ): Promise<void> => {
    if (!this.automationOutbox) return;
    await this.automationOutbox.enqueue(this.termsRepository.manager, {
      type: AutomationEventType.TERM_CHANGED,
      schoolId,
      aggregateType: 'Term',
      aggregateId: termId,
      payload: { termId, reason },
    });
  };

  createSession = (input: CreateSessionInput, schoolId: string) => {
    const session = this.sessionsRepository.create({
      name: input.name,
      schoolId,
    });
    return this.sessionsRepository.save(session);
  };

  private calculateWeekdays(
    startDate: Date | string,
    endDate: Date | string,
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start > end) {
      throw new BadRequestException(
        'The start date cannot be after the end date',
      );
    }

    let count = 0;
    const current = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );
    const utcEnd = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
    );

    while (current <= utcEnd) {
      const dayOfWeek = current.getUTCDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // 0 = Sunday, 6 = Saturday
        count++;
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return count;
  }

  createTerm = (input: CreateTermInput, schoolId: string) => {
    const calculatedDays = this.calculateWeekdays(
      input.startDate,
      input.endDate,
    );

    const term = this.termsRepository.create({
      name: input.name,
      sessionId: input.sessionId,
      schoolId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalSchoolDays: calculatedDays,
      status: TermStatus.CLOSED,
    });
    return this.termsRepository.save(term);
  };

  activateTerm = (termId: string, schoolId: string) => {
    // First verify the target term belongs to this school
    return this.termsRepository
      .findOne({ where: { id: termId, schoolId } })
      .then((term) => {
        if (!term) throw new NotFoundException('Term not found in your school');
        // The session the active term belongs to becomes the active session,
        // and all other sessions are deactivated
        return (
          this.sessionsRepository
            .update({ schoolId }, { isActive: false })
            .then(() =>
              this.sessionsRepository.update(
                { id: term.sessionId, schoolId },
                { isActive: true },
              ),
            )
            // Close any currently active term for this school
            .then(() =>
              this.termsRepository.update(
                { schoolId, status: TermStatus.ACTIVE },
                { status: TermStatus.CLOSED },
              ),
            )
            .then(() =>
              this.termsRepository
                .update({ id: termId, schoolId }, { status: TermStatus.ACTIVE })
                .then(async () => {
                  await this.emitAutomationEvent(
                    termId,
                    schoolId,
                    'term_activated',
                  );
                  return this.findTermById(termId);
                }),
            )
        );
      });
  };

  closeTerm = (termId: string, schoolId: string) => {
    return this.termsRepository
      .update({ id: termId, schoolId }, { status: TermStatus.CLOSED })
      .then(async () => {
        await this.emitAutomationEvent(termId, schoolId, 'term_closed');
        return this.findTermById(termId);
      });
  };

  resolveActiveTermForMetrics = async (
    schoolId: string,
  ): Promise<ActiveTermResolution> => {
    const terms = await this.termsRepository.find({
      where: { schoolId, status: TermStatus.ACTIVE },
      relations: ['session'],
    });
    if (terms.length === 0) {
      return {
        term: null,
        reason: 'No active term is configured for this school',
      };
    }
    if (terms.length > 1) {
      return {
        term: null,
        reason: 'Multiple active terms are configured for this school',
      };
    }
    const term = terms[0];
    if (!term.sessionId || !term.session) {
      return {
        term: null,
        reason: 'No active session is configured for this school',
      };
    }
    return { term };
  };

  getActiveTerm = (schoolId: string) => {
    return this.termsRepository
      .findOne({
        where: { schoolId, status: TermStatus.ACTIVE },
        relations: ['session'],
      })
      .then((term) => {
        if (!term)
          throw new NotFoundException('No active term found for this school');
        return term;
      });
  };

  getTermById = (id: string, schoolId: string) => {
    return this.termsRepository.findOne({
      where: { id, schoolId },
      relations: ['session'],
    });
  };

  getSessionById = (id: string, schoolId: string) => {
    return this.sessionsRepository.findOne({
      where: { id, schoolId },
      relations: ['terms'],
    });
  };

  getSessionsBySchool = (schoolId: string) => {
    return this.sessionsRepository.find({
      where: { schoolId },
      relations: ['terms'],
      order: { createdAt: 'DESC' },
    });
  };

  getTermsBySession = (sessionId: string, schoolId: string) => {
    // Validate the session belongs to this school to prevent cross-school data access
    return this.sessionsRepository
      .findOne({ where: { id: sessionId, schoolId } })
      .then((session) => {
        if (!session)
          throw new NotFoundException('Session not found in your school');
        return this.termsRepository.find({
          where: { sessionId },
          order: { startDate: 'ASC' },
        });
      });
  };

  unlockTerm = (termId: string, schoolId: string) => {
    return this.termsRepository
      .update({ id: termId, schoolId }, { status: TermStatus.ACTIVE })
      .then(async () => {
        await this.emitAutomationEvent(termId, schoolId, 'term_unlocked');
        return this.findTermById(termId);
      });
  };

  updateTotalSchoolDays = (termId: string, days: number, schoolId: string) => {
    return this.termsRepository
      .update({ id: termId, schoolId }, { totalSchoolDays: days })
      .then(() => this.findTermById(termId));
  };

  private findTermById = (id: string) => {
    return this.termsRepository
      .findOne({ where: { id }, relations: ['session'] })
      .then((term) => {
        if (!term) throw new NotFoundException('Term not found');
        return term;
      });
  };
}
