import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GuardianAccessAuditLog } from '../entities/guardian-access-audit-log.entity';
import { GuardianAuditAction } from '../enums/guardian-policy.enums';

@Injectable()
export class GuardianAccessAuditService {
  constructor(
    @InjectRepository(GuardianAccessAuditLog)
    private readonly auditRepo: Repository<GuardianAccessAuditLog>,
  ) {}

  record = async (
    schoolId: string,
    actorId: string,
    action: GuardianAuditAction,
    entityType: string,
    entityId: string | null,
    beforeState: Record<string, unknown> | null,
    afterState: Record<string, unknown> | null,
  ): Promise<GuardianAccessAuditLog> => {
    const audit = this.auditRepo.create({
      schoolId,
      actorId,
      action,
      entityType,
      entityId,
      beforeState,
      afterState,
    });
    return this.auditRepo.save(audit);
  };

  list = async (schoolId: string): Promise<GuardianAccessAuditLog[]> => {
    return this.auditRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
  };
}
