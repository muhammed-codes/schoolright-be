import { registerEnumType } from '@nestjs/graphql';

export enum GuardianResource {
  CHILD_PROFILE = 'CHILD_PROFILE',
  RESULTS = 'RESULTS',
  ATTENDANCE = 'ATTENDANCE',
  TIMETABLE = 'TIMETABLE',
  FEES = 'FEES',
  INVOICES = 'INVOICES',
  PAYMENT_SUBMISSION = 'PAYMENT_SUBMISSION',
  PAYMENT_HISTORY = 'PAYMENT_HISTORY',
  RECEIPTS = 'RECEIPTS',
  COMMUNICATION = 'COMMUNICATION',
}

export enum GuardianAction {
  VIEW = 'VIEW',
  SUBMIT = 'SUBMIT',
}

registerEnumType(GuardianResource, { name: 'GuardianResource' });
registerEnumType(GuardianAction, { name: 'GuardianAction' });
