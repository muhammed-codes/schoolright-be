export interface ReceiptBrandingConfig {
  showSchoolName: boolean;
  customSchoolName?: string;
  showLogo: boolean;
  logoWidth?: number;
  logoPosition?: 'left' | 'center' | 'right';
  showAddress: boolean;
  customAddress?: string;
  showContactInfo: boolean;
  contactInfoText?: string;
  receiptTitle: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  headerBackgroundColor: string;
  headerTextColor: string;
  fontFamily: string;
  headerAlignment: 'left' | 'center' | 'right';
}

export interface ReceiptLayoutConfig {
  paperSize: 'A4' | 'A5' | 'THERMAL_80MM';
  orientation: 'portrait' | 'landscape';
  compactMode?: boolean;
  showWatermark?: boolean;
  watermarkText?: string;
}

export interface ReceiptStudentInfoConfig {
  showStudentName: boolean;
  studentNameLabel: string;
  showAdmissionNumber: boolean;
  admissionNumberLabel: string;
  showClass: boolean;
  classLabel: string;
  showGuardianName: boolean;
  guardianNameLabel: string;
  layoutStyle: 'grid' | 'inline' | 'stacked';
}

export interface ReceiptPaymentDetailsConfig {
  showReceiptNumber: boolean;
  receiptNumberLabel: string;
  showDate: boolean;
  dateLabel: string;
  showPaymentMethod: boolean;
  paymentMethodLabel: string;
  showTransactionReference: boolean;
  transactionReferenceLabel: string;
  showBankDetails: boolean;
  bankDetailsText?: string;
  showAmountInWords: boolean;
}

export interface ReceiptFeeBreakdownConfig {
  showItemsTable: boolean;
  showPreviousBalance: boolean;
  previousBalanceLabel: string;
  showTotalDue: boolean;
  totalDueLabel: string;
  showAmountPaid: boolean;
  amountPaidLabel: string;
  showOutstandingBalance: boolean;
  outstandingBalanceLabel: string;
  showPaymentHistory: boolean;
  headerBackgroundColor: string;
  headerTextColor: string;
  showBorders: boolean;
}

export interface ReceiptFooterConfig {
  showNotes: boolean;
  notesTitle?: string;
  notesText?: string;
  showTermsAndConditions: boolean;
  termsText?: string;
  showSignature: boolean;
  signatureTitle?: string;
  signatureImageUrl?: string;
  showStamp: boolean;
  stampImageUrl?: string;
  showQrCode: boolean;
}

export interface ReceiptTemplateConfig {
  branding: ReceiptBrandingConfig;
  layout: ReceiptLayoutConfig;
  studentInfo: ReceiptStudentInfoConfig;
  paymentDetails: ReceiptPaymentDetailsConfig;
  feeBreakdown: ReceiptFeeBreakdownConfig;
  footer: ReceiptFooterConfig;
}

export const getDefaultReceiptTemplateConfig = (
  schoolName = 'SchoolRight Academy',
  primaryColor = '#1e3a8a',
): ReceiptTemplateConfig => ({
  branding: {
    showSchoolName: true,
    customSchoolName: schoolName,
    showLogo: true,
    logoWidth: 64,
    logoPosition: 'left',
    showAddress: true,
    customAddress: 'Plot 123 Education Boulevard, Victoria Island, Lagos',
    showContactInfo: true,
    contactInfoText: 'Tel: +234 800 000 0000 | Email: accounts@school.edu',
    receiptTitle: 'OFFICIAL PAYMENT RECEIPT',
    primaryColor,
    secondaryColor: '#475569',
    accentColor: '#0ea5e9',
    headerBackgroundColor: '#f8fafc',
    headerTextColor: '#0f172a',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    headerAlignment: 'left',
  },
  layout: {
    paperSize: 'A4',
    orientation: 'portrait',
    compactMode: false,
    showWatermark: false,
    watermarkText: 'PAID',
  },
  studentInfo: {
    showStudentName: true,
    studentNameLabel: 'Student Name',
    showAdmissionNumber: true,
    admissionNumberLabel: 'Admission Number',
    showClass: true,
    classLabel: 'Class / Grade',
    showGuardianName: true,
    guardianNameLabel: 'Paid By / Guardian',
    layoutStyle: 'grid',
  },
  paymentDetails: {
    showReceiptNumber: true,
    receiptNumberLabel: 'Receipt No',
    showDate: true,
    dateLabel: 'Payment Date',
    showPaymentMethod: true,
    paymentMethodLabel: 'Payment Method',
    showTransactionReference: true,
    transactionReferenceLabel: 'Reference',
    showBankDetails: true,
    bankDetailsText: 'Direct Bank Transfer / Dedicated Virtual Account',
    showAmountInWords: true,
  },
  feeBreakdown: {
    showItemsTable: true,
    showPreviousBalance: true,
    previousBalanceLabel: 'Previous Balance',
    showTotalDue: true,
    totalDueLabel: 'Total Due',
    showAmountPaid: true,
    amountPaidLabel: 'Amount Paid',
    showOutstandingBalance: true,
    outstandingBalanceLabel: 'Remaining Balance',
    showPaymentHistory: false,
    headerBackgroundColor: '#f1f5f9',
    headerTextColor: '#0f172a',
    showBorders: true,
  },
  footer: {
    showNotes: true,
    notesTitle: 'Note',
    notesText: 'Thank you for your prompt payment. This receipt serves as official proof of payment.',
    showTermsAndConditions: true,
    termsText: 'Fees paid are strictly non-refundable and non-transferable.',
    showSignature: true,
    signatureTitle: 'Authorized Bursar / Accounts',
    showStamp: true,
    showQrCode: true,
  },
});
