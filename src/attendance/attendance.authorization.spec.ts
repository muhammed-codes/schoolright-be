import { AttendanceService } from './attendance.service';
import { UserRole } from '../common/enums';

describe('AttendanceService parent access', () => {
  const make = () => {
    const studentAttendanceRepo = { find: jest.fn().mockResolvedValue([]) };
    const studentRepo = { findOne: jest.fn() };
    const termRepo = { findOne: jest.fn() };
    const studentParentRepo = { findOne: jest.fn() };
    const service = new AttendanceService(
      studentAttendanceRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      termRepo as any,
      studentParentRepo as any,
      studentRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return {
      service,
      studentAttendanceRepo,
      studentRepo,
      termRepo,
      studentParentRepo,
    };
  };

  const scope = () => {
    const deps = make();
    deps.studentRepo.findOne.mockResolvedValue({
      id: 'student-a',
      schoolId: 'school-a',
    });
    deps.termRepo.findOne.mockResolvedValue({ id: 'term-a', schoolId: 'school-a' });
    deps.studentParentRepo.findOne.mockResolvedValue({
      studentId: 'student-a',
      parentId: 'parent-a',
    });
    return deps;
  };

  it('allows a parent to read attendance for a linked child in the same school', async () => {
    const { service, studentAttendanceRepo } = scope();

    await expect(
      service.getStudentAttendance(
        'student-a',
        'term-a',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).resolves.toEqual([]);
    expect(studentAttendanceRepo.find).toHaveBeenCalledWith({
      where: { studentId: 'student-a', termId: 'term-a' },
      order: { date: 'ASC' },
    });
  });

  it('denies a parent access to an unlinked child', async () => {
    const { service, studentParentRepo } = scope();
    studentParentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentAttendance(
        'student-b',
        'term-a',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).rejects.toThrow('You do not have access to view this student attendance');
  });

  it('rejects a student from another school', async () => {
    const { service, studentRepo } = scope();
    studentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentAttendanceSummary(
        'student-b',
        'term-a',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).rejects.toThrow('Student not found');
  });

  it('rejects a term from another school', async () => {
    const { service, termRepo } = scope();
    termRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentAttendanceSummary(
        'student-a',
        'term-b',
        'parent-a',
        UserRole.PARENT,
        'school-a',
      ),
    ).rejects.toThrow('Term not found');
  });
});
