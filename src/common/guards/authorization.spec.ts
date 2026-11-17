import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { RolesGuard } from './roles.guard';
import { AccessService } from '../../access/access.service';
import { RecordScopeService } from '../../access/record-scope.service';
import { UserRole } from '../enums/role.enum';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppResource } from '../../access/enums/resource.enum';
import { PermissionAction } from '../../access/enums/permission-action.enum';
import { FeesResolver } from '../../fees/fees.resolver';
import { AttendanceResolver } from '../../attendance/attendance.resolver';
import { ResultsResolver } from '../../results/results.resolver';
import { CommunicationResolver } from '../../communication/communication.resolver';

const context = (user?: unknown) =>
  ({
    getType: () => 'http',
    getHandler: () => function student() {},
    getClass: () => class Controller {},
    getArgs: () => [],
    getArgByIndex: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user, body: { studentId: 'foreign' } }),
    }),
  }) as unknown as ExecutionContext;

describe('authorization guards', () => {
  const reflect = (permission?: unknown, roles?: UserRole[]) =>
    ({
      getAllAndOverride: jest.fn((key: string) =>
        key === PERMISSION_KEY
          ? permission
          : key === ROLES_KEY
            ? roles
            : undefined,
      ),
    }) as unknown as Reflector;
  it('fails closed without authorization metadata', async () => {
    const guard = new PermissionGuard(
      reflect(),
      {} as AccessService,
      {} as RecordScopeService,
    );
    await expect(guard.canActivate(context())).resolves.toBe(false);
    expect(new RolesGuard(reflect()).canActivate(context())).toBe(false);
  });
  it('does not authorize an anonymous REST request', async () => {
    const guard = new PermissionGuard(
      reflect({
        resource: AppResource.STUDENTS,
        action: PermissionAction.READ,
      }),
      {} as AccessService,
      {} as RecordScopeService,
    );
    await expect(guard.canActivate(context())).resolves.toBe(false);
  });
  it('enforces ownership for school administrators before the module exemption', async () => {
    const hasPermission = jest.fn().mockResolvedValue(true);
    const assertArguments = jest
      .fn()
      .mockRejectedValue(new Error('foreign school'));
    const guard = new PermissionGuard(
      reflect({
        resource: AppResource.STUDENTS,
        action: PermissionAction.READ,
      }),
      { hasPermission } as unknown as AccessService,
      { assertArguments } as unknown as RecordScopeService,
    );
    await expect(
      guard.canActivate(
        context({
          sub: 'admin',
          role: UserRole.SCHOOL_ADMIN,
          schoolId: 'school-a',
        }),
      ),
    ).rejects.toThrow('foreign school');
    expect(hasPermission).not.toHaveBeenCalled();
  });
  it('checks roles on REST requests', () => {
    const guard = new RolesGuard(reflect(undefined, [UserRole.SCHOOL_ADMIN]));
    expect(() =>
      guard.canActivate(context({ role: UserRole.CLASS_TEACHER })),
    ).toThrow();
    expect(guard.canActivate(context({ role: UserRole.SCHOOL_ADMIN }))).toBe(
      true,
    );
  });
});

describe('resolver role metadata', () => {
  const canActivate = (
    role: UserRole,
    resolverClass: new (...args: never[]) => unknown,
    methodName: string,
  ) => {
    const handler = Reflect.get(resolverClass.prototype, methodName) as (
      ...args: unknown[]
    ) => unknown;
    const context = {
      getType: () => 'http',
      getHandler: () => handler,
      getClass: () => resolverClass,
      getArgs: () => [],
      getArgByIndex: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    } as unknown as ExecutionContext;
    return new RolesGuard(new Reflector()).canActivate(context);
  };

  it('denies parents on school-wide fee operations', () => {
    expect(() =>
      canActivate(UserRole.PARENT, FeesResolver, 'invoices'),
    ).toThrow('You do not have the required role');
  });

  it('allows parents on fee operations intended for guardians', () => {
    expect(canActivate(UserRole.PARENT, FeesResolver, 'bankAccounts')).toBe(
      true,
    );
    expect(canActivate(UserRole.PARENT, FeesResolver, 'paymentReceipt')).toBe(
      true,
    );
  });

  it('denies parents on staff-only attendance, results, and announcement operations', () => {
    expect(() =>
      canActivate(UserRole.PARENT, AttendanceResolver, 'staffAttendanceLog'),
    ).toThrow('You do not have the required role');
    expect(() =>
      canActivate(UserRole.PARENT, ResultsResolver, 'resultAnalytics'),
    ).toThrow('You do not have the required role');
    expect(() =>
      canActivate(
        UserRole.PARENT,
        CommunicationResolver,
        'adminAnnouncementsPage',
      ),
    ).toThrow('You do not have the required role');
  });

  it('allows parents on their own attendance, results, and announcements', () => {
    expect(
      canActivate(UserRole.PARENT, AttendanceResolver, 'studentAttendance'),
    ).toBe(true);
    expect(canActivate(UserRole.PARENT, ResultsResolver, 'studentResult')).toBe(
      true,
    );
    expect(
      canActivate(UserRole.PARENT, CommunicationResolver, 'announcement'),
    ).toBe(true);
  });

  it('preserves super admin access to staff-only operations', () => {
    expect(canActivate(UserRole.SUPER_ADMIN, FeesResolver, 'invoices')).toBe(
      true,
    );
    expect(
      canActivate(
        UserRole.SUPER_ADMIN,
        CommunicationResolver,
        'adminAnnouncementsPage',
      ),
    ).toBe(true);
  });
});
