import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../common/enums';
import { GuardianAccessException } from '../entities/guardian-access-exception.entity';
import {
  CreateGuardianExceptionInput,
  UpdateGuardianExceptionInput,
} from '../dto/guardian-exception.input';
import {
  GuardianAction,
  GuardianResource,
} from '../enums/guardian-permission.enums';
import {
  GuardianAuditAction,
  GuardianEffect,
} from '../enums/guardian-policy.enums';
import { GuardianAccessAuditService } from './guardian-access-audit.service';
import { GuardianManagementUser } from './guardian-policy-management.service';

@Injectable()
export class GuardianExceptionService {
  constructor(
    @InjectRepository(GuardianAccessException)
    private readonly exceptionRepo: Repository<GuardianAccessException>,
    private readonly auditService: GuardianAccessAuditService,
  ) {}

  resolveSchoolId = (
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): string => {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!requestedSchoolId) {
        throw new BadRequestException('A school scope is required');
      }
      return requestedSchoolId;
    }
    if (user.role !== UserRole.SCHOOL_ADMIN || !user.schoolId) {
      throw new ForbiddenException('Administrator access is required');
    }
    return user.schoolId;
  };

  list = async (
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianAccessException[]> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    return this.exceptionRepo.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
  };

  listForStudent = async (
    studentId: string,
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianAccessException[]> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    return this.exceptionRepo.find({
      where: { schoolId, studentId },
      order: { createdAt: 'DESC' },
    });
  };

  create = async (
    input: CreateGuardianExceptionInput,
    user: GuardianManagementUser,
    requestedSchoolId?: string,
  ): Promise<GuardianAccessException> => {
    const schoolId = this.resolveSchoolId(user, requestedSchoolId);
    if (!input.studentId)
      throw new BadRequestException('A student is required');
    if (!input.reason?.trim()) {
      throw new BadRequestException('An exception reason is required');
    }
    this.validateEnum(input.resource, GuardianResource, 'resource');
    this.validateEnum(input.action, GuardianAction, 'action');
    this.validateEnum(input.effect, GuardianEffect, 'effect');
    const exception = this.exceptionRepo.create({
      schoolId,
      studentId: input.studentId,
      guardianId: input.guardianId ?? null,
      resource: input.resource,
      action: input.action,
      effect: input.effect,
      reason: input.reason.trim(),
      expiresAt: input.expiresAt ?? null,
      createdById: user.sub,
      updatedById: user.sub,
    });
    const saved = await this.exceptionRepo.save(exception);
    await this.auditService.record(
      schoolId,
      user.sub,
      GuardianAuditAction.EXCEPTION_CREATED,
      'GuardianAccessException',
      saved.id,
      null,
      this.snapshot(saved),
    );
    return saved;
  };

  update = async (
    input: UpdateGuardianExceptionInput,
    user: GuardianManagementUser,
  ): Promise<GuardianAccessException> => {
    const exception = await this.loadException(input.id);
    this.assertSchoolAccess(user, exception.schoolId);
    const before = this.snapshot(exception);
    if (input.effect !== undefined) {
      this.validateEnum(input.effect, GuardianEffect, 'effect');
      exception.effect = input.effect;
    }
    if (input.reason !== undefined) {
      if (!input.reason.trim()) {
        throw new BadRequestException('An exception reason is required');
      }
      exception.reason = input.reason.trim();
    }
    if (input.expiresAt !== undefined) exception.expiresAt = input.expiresAt;
    exception.updatedById = user.sub;
    await this.exceptionRepo.save(exception);
    await this.auditService.record(
      exception.schoolId,
      user.sub,
      GuardianAuditAction.EXCEPTION_UPDATED,
      'GuardianAccessException',
      exception.id,
      before,
      this.snapshot(exception),
    );
    return exception;
  };

  remove = async (
    id: string,
    user: GuardianManagementUser,
  ): Promise<boolean> => {
    const exception = await this.loadException(id);
    this.assertSchoolAccess(user, exception.schoolId);
    await this.auditService.record(
      exception.schoolId,
      user.sub,
      GuardianAuditAction.EXCEPTION_REMOVED,
      'GuardianAccessException',
      id,
      this.snapshot(exception),
      null,
    );
    await this.exceptionRepo.delete(id);
    return true;
  };

  loadException = async (id: string): Promise<GuardianAccessException> => {
    const exception = await this.exceptionRepo.findOne({ where: { id } });
    if (!exception) throw new NotFoundException('Guardian exception not found');
    return exception;
  };

  assertSchoolAccess = (
    user: GuardianManagementUser,
    schoolId: string,
  ): void => {
    if (user.role === UserRole.SUPER_ADMIN) return;
    if (user.role !== UserRole.SCHOOL_ADMIN) {
      throw new ForbiddenException('Administrator access is required');
    }
    if (user.schoolId !== schoolId) {
      throw new ForbiddenException('Guardian exception is outside your school');
    }
  };

  private validateEnum = (
    value: unknown,
    enumeration: Record<string, string>,
    field: string,
  ): void => {
    if (!Object.values(enumeration).includes(value as string)) {
      throw new BadRequestException(`Invalid ${field}`);
    }
  };

  private snapshot = (
    exception: GuardianAccessException,
  ): Record<string, unknown> => ({
    id: exception.id,
    schoolId: exception.schoolId,
    studentId: exception.studentId,
    guardianId: exception.guardianId,
    resource: exception.resource,
    action: exception.action,
    effect: exception.effect,
    reason: exception.reason,
    expiresAt: exception.expiresAt,
  });
}
