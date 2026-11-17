import { StudentsService } from './students.service';

describe('StudentsService parent access', () => {
  const make = () => {
    const studentParentsRepository = { findOne: jest.fn(), find: jest.fn() };
    const studentsRepository = { findOne: jest.fn() };
    const usersService = { findById: jest.fn() };
    const service = Object.create(StudentsService.prototype) as StudentsService;
    Object.assign(service, {
      studentParentsRepository,
      studentsRepository,
      usersService,
    });
    return {
      service,
      studentParentsRepository,
      studentsRepository,
      usersService,
    };
  };

  it('returns only a linked child to a parent', async () => {
    const { service, studentParentsRepository, studentsRepository } = make();
    studentParentsRepository.findOne.mockResolvedValue({
      studentId: 'student-a',
      parentId: 'parent-a',
    });
    studentsRepository.findOne.mockResolvedValue({
      id: 'student-a',
      schoolId: 'school-a',
    });

    await expect(
      service.getLinkedStudentById('student-a', 'parent-a', 'school-a'),
    ).resolves.toMatchObject({ id: 'student-a' });
    expect(studentParentsRepository.findOne).toHaveBeenCalledWith({
      where: { studentId: 'student-a', parentId: 'parent-a' },
    });
    expect(studentsRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'student-a', schoolId: 'school-a' },
      }),
    );
  });

  it('denies a parent access to an unlinked child', async () => {
    const { service, studentParentsRepository } = make();
    studentParentsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getLinkedStudentById('student-b', 'parent-a', 'school-a'),
    ).rejects.toThrow('Student is not linked to you');
  });

  it('denies a parent access to a child in another school', async () => {
    const { service, studentParentsRepository, studentsRepository } = make();
    studentParentsRepository.findOne.mockResolvedValue({
      studentId: 'student-b',
      parentId: 'parent-a',
    });
    studentsRepository.findOne.mockResolvedValue(null);

    await expect(
      service.getLinkedStudentById('student-b', 'parent-a', 'school-a'),
    ).rejects.toThrow('Student not found');
  });

  it('rejects a guardian argument from another school', async () => {
    const { service, usersService } = make();
    usersService.findById.mockResolvedValue({
      id: 'guardian-b',
      schoolId: 'school-b',
    });

    await expect(
      service.getStudentsByGuardian('guardian-b', 'school-a'),
    ).rejects.toThrow('Guardian is outside your school');
  });
});
