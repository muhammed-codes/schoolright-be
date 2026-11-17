import { ResultsService } from './results.service';
import { ResultStatus, UserRole } from '../common/enums';

describe('ResultsService parent access', () => {
  const make = () => {
    const query = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const studentResultRepo = { createQueryBuilder: jest.fn().mockReturnValue(query) };
    const studentRepo = { findOne: jest.fn() };
    const termRepo = { findOne: jest.fn() };
    const studentParentRepo = { findOne: jest.fn() };
    const resultSheetRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new ResultsService(
      resultSheetRepo as any,
      studentResultRepo as any,
      {} as any,
      {} as any,
      {} as any,
      studentRepo as any,
      studentParentRepo as any,
      termRepo as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return {
      service,
      query,
      studentResultRepo,
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

  it('allows a parent to query results for a linked child', async () => {
    const { service, query } = scope();

    await expect(
      service.getStudentResult(
        'student-a',
        'term-a',
        'school-a',
        'parent-a',
        UserRole.PARENT,
      ),
    ).resolves.toBeNull();
    expect(query.andWhere).toHaveBeenCalledWith(
      'rs.status = :publishedStatus',
      { publishedStatus: ResultStatus.PUBLISHED },
    );
  });

  it('denies a parent access to an unlinked child', async () => {
    const { service, studentParentRepo } = scope();
    studentParentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentResult(
        'student-b',
        'term-a',
        'school-a',
        'parent-a',
        UserRole.PARENT,
      ),
    ).rejects.toThrow('You do not have access to this student result');
  });

  it('rejects a student from another school', async () => {
    const { service, studentRepo } = scope();
    studentRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getMyChildResults('student-b', 'parent-a', 'school-a'),
    ).rejects.toThrow('Student not found');
  });

  it('rejects a term from another school', async () => {
    const { service, termRepo } = scope();
    termRepo.findOne.mockResolvedValue(null);

    await expect(
      service.getStudentResult(
        'student-a',
        'term-b',
        'school-a',
        'parent-a',
        UserRole.PARENT,
      ),
    ).rejects.toThrow('Term not found');
  });
});
