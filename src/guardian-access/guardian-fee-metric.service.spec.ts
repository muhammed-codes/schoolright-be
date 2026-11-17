import { Repository } from 'typeorm';
import { TermStatus } from '../common/enums';
import { StudentInvoice } from '../fees/entities/student-invoice.entity';
import { Session } from '../terms/entities/session.entity';
import { Term } from '../terms/entities/term.entity';
import { GuardianFeeMetricService } from './services/guardian-fee-metric.service';

describe('guardian fee metric service', () => {
  const buildService = (
    invoices: Partial<StudentInvoice>[],
    term: Partial<Term> | null = {
      id: 'term-a',
      sessionId: 'session-a',
      status: TermStatus.ACTIVE,
    },
  ) => {
    const invoiceRepo = {
      find: jest.fn().mockResolvedValue(invoices as StudentInvoice[]),
    } as unknown as Repository<StudentInvoice>;
    const termRepo = {
      findOne: jest.fn().mockResolvedValue(term as Term | null),
    } as unknown as Repository<Term>;
    const sessionRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'session-a' } as Session),
    } as unknown as Repository<Session>;
    const service = new GuardianFeeMetricService(
      invoiceRepo,
      termRepo,
      sessionRepo,
    );
    return { service, invoiceRepo };
  };

  it('combines active term and session invoices using invoice totals', async () => {
    const { service, invoiceRepo } = buildService([
      { totalAmount: 1000, totalPaid: 500, balance: 500 },
      { totalAmount: 2000, totalPaid: 1000, balance: 1000 },
    ]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.feePaymentPercentage).toBe(50);
    expect(result.outstandingBalance).toBe(1500);
    expect(result.unavailable).toEqual({});
    expect(invoiceRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: [
          { schoolId: 'school-a', studentId: 'student-a', termId: 'term-a' },
          {
            schoolId: 'school-a',
            studentId: 'student-a',
            sessionId: 'session-a',
            termId: expect.anything(),
          },
        ],
      }),
    );
  });

  it('returns unavailable state when no applicable invoices exist', async () => {
    const { service } = buildService([]);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.feePaymentPercentage).toBeUndefined();
    expect(result.unavailable.feePaymentPercentage).toContain(
      'No applicable invoices',
    );
  });

  it('returns unavailable state when there is no active term', async () => {
    const { service } = buildService([], null);
    const result = await service.calculateForStudent('student-a', 'school-a');
    expect(result.unavailable.outstandingBalance).toContain('No active term');
  });
});
