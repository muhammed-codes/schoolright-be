import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UserRole } from '../common/enums';
import { GuardianAccessPolicy } from './entities/guardian-access-policy.entity';
import { GuardianAccessPolicyRule } from './entities/guardian-access-policy-rule.entity';
import {
  GuardianAction,
  GuardianResource,
} from './enums/guardian-permission.enums';
import {
  GuardianAuditAction,
  GuardianEffect,
  GuardianPolicyScope,
} from './enums/guardian-policy.enums';
import { GuardianAccessAuditService } from './services/guardian-access-audit.service';
import { GuardianConditionValidator } from './services/guardian-condition-validator.service';
import { GuardianPolicyManagementService } from './services/guardian-policy-management.service';

describe('guardian policy management', () => {
  const admin = {
    sub: 'admin-a',
    role: UserRole.SCHOOL_ADMIN,
    schoolId: 'school-a',
  };
  const record = jest.fn();
  const auditService = { record } as unknown as GuardianAccessAuditService;
  const validator = new GuardianConditionValidator();

  const buildService = (existing: GuardianAccessPolicy[] = []) => {
    const savedPolicies: GuardianAccessPolicy[] = [];
    const savePolicy = jest.fn((policy: GuardianAccessPolicy) => {
      savedPolicies.push({
        ...policy,
        rules: policy.rules ?? [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return Promise.resolve(policy);
    });
    const policyRepo = {
      findOne: jest.fn(({ where }: { where: Record<string, string> }) => {
        const saved = savedPolicies.find((policy) => policy.id === where.id);
        if (saved) return Promise.resolve(saved);
        return Promise.resolve(
          existing.find((policy) =>
            Object.entries(where).every(
              ([key, value]) =>
                policy[key as keyof GuardianAccessPolicy] === value,
            ),
          ) ?? null,
        );
      }),
      create: jest.fn((data: Partial<GuardianAccessPolicy>) => ({
        id: 'new-policy',
        rules: [],
        ...data,
      })),
      save: savePolicy,
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    } as unknown as Repository<GuardianAccessPolicy>;
    const ruleRepo = {
      create: jest.fn((rules: Partial<GuardianAccessPolicyRule>[]) =>
        rules.map((rule, index) => ({ id: `rule-${index}`, ...rule })),
      ),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<GuardianAccessPolicyRule>;
    const service = new GuardianPolicyManagementService(
      policyRepo,
      ruleRepo,
      auditService,
      validator,
    );
    return { service, policyRepo, savePolicy };
  };

  beforeEach(() => record.mockReset());

  it('derives school scope from the authenticated administrator', () => {
    const { service } = buildService();
    expect(service.resolveSchoolId(admin, 'school-b')).toBe('school-a');
    expect(() =>
      service.resolveSchoolId(
        { sub: 'parent', role: UserRole.PARENT, schoolId: 'school-a' },
        'school-a',
      ),
    ).toThrow(ForbiddenException);
  });

  it('denies cross-school policy access', async () => {
    const { service } = buildService();
    await expect(
      service.get('policy-a', {
        sub: 'admin-a',
        role: UserRole.SCHOOL_ADMIN,
        schoolId: 'school-a',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(() => service.assertSchoolAccess(admin, 'school-b')).toThrow(
      'outside your school',
    );
  });

  it('rejects dynamic policies without a typed condition', async () => {
    const { service } = buildService();
    await expect(
      service.create(
        {
          name: 'Segment',
          scope: GuardianPolicyScope.DYNAMIC_SEGMENT,
          rules: [
            {
              resource: GuardianResource.FEES,
              action: GuardianAction.VIEW,
              effect: GuardianEffect.ALLOW,
            },
          ],
        },
        admin,
      ),
    ).rejects.toThrow('requires a condition');
  });

  it('creates a school default policy and records an audit log', async () => {
    const { service, savePolicy } = buildService();
    const created = await service.create(
      {
        name: 'Default',
        scope: GuardianPolicyScope.SCHOOL_DEFAULT,
        rules: [
          {
            resource: GuardianResource.FEES,
            action: GuardianAction.VIEW,
            effect: GuardianEffect.ALLOW,
          },
        ],
      },
      admin,
    );
    expect(created.schoolId).toBe('school-a');
    expect(savePolicy).toHaveBeenCalled();
    expect(record).toHaveBeenCalledWith(
      'school-a',
      'admin-a',
      GuardianAuditAction.POLICY_CREATED,
      'GuardianAccessPolicy',
      'new-policy',
      null,
      expect.objectContaining({ schoolId: 'school-a' }),
    );
  });

  it('rejects duplicate school default policies', async () => {
    const { service } = buildService([
      {
        id: 'existing-policy',
        schoolId: 'school-a',
        name: 'Default',
        scope: GuardianPolicyScope.SCHOOL_DEFAULT,
        enabled: true,
        priority: 0,
        createdById: 'admin-a',
        updatedById: 'admin-a',
        rules: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as GuardianAccessPolicy,
    ]);
    await expect(
      service.create(
        {
          name: 'Second default',
          scope: GuardianPolicyScope.SCHOOL_DEFAULT,
          rules: [
            {
              resource: GuardianResource.FEES,
              action: GuardianAction.VIEW,
              effect: GuardianEffect.ALLOW,
            },
          ],
        },
        admin,
      ),
    ).rejects.toThrow('already exists');
  });
});
