import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TermStatus } from '../../common/enums';
import { Session } from '../../terms/entities/session.entity';
import { Term } from '../../terms/entities/term.entity';
import { StudentInvoice } from '../../fees/entities/student-invoice.entity';
import { GuardianFeeMetricScope } from '../enums/guardian-condition.enums';
import { GuardianStudentMetrics } from '../interfaces/guardian-condition.interface';

@Injectable()
export class GuardianFeeMetricService {
  constructor(
    @InjectRepository(StudentInvoice)
    private readonly invoiceRepo: Repository<StudentInvoice>,
    @InjectRepository(Term)
    private readonly termRepo: Repository<Term>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {}

  calculateForStudent = async (
    studentId: string,
    schoolId: string,
    scope: GuardianFeeMetricScope = GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES,
  ): Promise<{
    feePaymentPercentage?: number;
    outstandingBalance?: number;
    unavailable: GuardianStudentMetrics['unavailable'];
  }> => {
    if (scope !== GuardianFeeMetricScope.ACTIVE_TERM_AND_SESSION_INVOICES) {
      throw new BadRequestException('Unsupported fee metric scope');
    }
    const activeTerm = await this.termRepo.findOne({
      where: { schoolId, status: TermStatus.ACTIVE },
      relations: ['session'],
    });
    if (!activeTerm) {
      return {
        unavailable: {
          feePaymentPercentage: 'No active term is configured for this school',
          outstandingBalance: 'No active term is configured for this school',
        },
      };
    }
    const activeSession = await this.sessionRepo.findOne({
      where: { schoolId, isActive: true },
    });
    const sessionId = activeSession?.id ?? activeTerm.sessionId;
    if (!sessionId) {
      return {
        unavailable: {
          feePaymentPercentage: 'No active session is configured for this school',
          outstandingBalance: 'No active session is configured for this school',
        },
      };
    }
    const invoices = await this.invoiceRepo.find({
      where: [
        { schoolId, studentId, termId: activeTerm.id },
        { schoolId, studentId, sessionId, termId: IsNull() },
      ],
    });
    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount ?? 0),
      0,
    );
    const totalPaid = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalPaid ?? 0),
      0,
    );
    const outstandingBalance = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.balance ?? 0),
      0,
    );
    if (totalAmount <= 0) {
      const reason = 'No applicable invoices with a positive total amount';
      return {
        unavailable: {
          feePaymentPercentage: reason,
          outstandingBalance: reason,
        },
      };
    }
    return {
      feePaymentPercentage: Number(((totalPaid / totalAmount) * 100).toFixed(2)),
      outstandingBalance,
      unavailable: {},
    };
  };
}
