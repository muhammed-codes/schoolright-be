import { FeesService } from './fees.service';
import { UserRole } from '../common/enums';

describe('FeesService parent access', () => {
  const make = () => {
    const invoiceRepo = { find: jest.fn().mockResolvedValue([]) };
    const studentRepo = { findOne: jest.fn() };
    const studentParentRepo = { findOne: jest.fn() };
    const service = Object.create(FeesService.prototype) as FeesService;
    Object.assign(service, { invoiceRepo, studentRepo, studentParentRepo });
    return { service, invoiceRepo, studentRepo, studentParentRepo };
  };

  it('allows a parent to read invoices for a linked child in the same school', async () => {
    const { service, studentParentRepo, studentRepo, invoiceRepo } = make();
    studentParentRepo.findOne.mockResolvedValue({
      studentId: 'student-a',
      parentId: 'parent-a',
    });
    studentRepo.findOne.mockResolvedValue({
      id: 'student-a',
      schoolId: 'school-a',
    });

    await expect(
      service.getStudentInvoicesForUser(
        'student-a',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).resolves.toEqual([]);
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'student-a', schoolId: 'school-a' },
      }),
    );
  });

  it('denies a parent access to an unlinked child', async () => {
    const { service, studentParentRepo } = make();
    studentParentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentInvoicesForUser(
        'student-b',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).rejects.toThrow('You do not have access to this invoice');
  });

  it('denies invoices for a child in another school', async () => {
    const { service, studentParentRepo, studentRepo } = make();
    studentParentRepo.findOne.mockResolvedValue({
      studentId: 'student-b',
      parentId: 'parent-a',
    });
    studentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentInvoicesForUser(
        'student-b',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).rejects.toThrow('Student not found');
  });

  it('denies a parent submission owned by another parent', async () => {
    const { service } = make();
    const batchRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'batch-a',
        schoolId: 'school-a',
        parentId: 'parent-b',
      }),
    };
    Object.assign(service, { batchRepo });

    await expect(
      service.getPaymentSubmissionById(
        'batch-a',
        'school-a',
        'parent-a',
        UserRole.PARENT,
      ),
    ).rejects.toThrow('You do not have access to this payment submission');
  });
});
