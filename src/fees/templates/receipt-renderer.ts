import { ReceiptTemplateConfig } from '../interfaces/receipt-template-config.interface';

export interface ReceiptItemData {
  id?: string;
  description: string;
  amount: number;
  amountPaid?: number;
  balance?: number;
}

export interface ReceiptRenderData {
  school: {
    name: string;
    logoUrl?: string | null;
    stampUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  student: {
    fullName: string;
    admissionNumber: string;
    className?: string | null;
  };
  guardian?: {
    fullName?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  payment: {
    serialNumber: string;
    generatedAt: Date | string;
    amount: number;
    paymentMethod?: string;
    reference?: string;
    bankName?: string;
    accountNumber?: string;
  };
  financialSummary: {
    previousBalance?: number;
    totalDue?: number;
    amountPaid: number;
    outstandingBalance?: number;
  };
  items: ReceiptItemData[];
}

const escapeHtml = (str?: string | null): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatCurrency = (amount?: number | null): string => {
  if (amount == null || isNaN(amount)) return '₦0.00';
  return `₦${Number(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const formatDate = (dateInput?: Date | string): string => {
  if (!dateInput) return new Date().toLocaleDateString('en-GB');
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const getDefaultLogoSvg = (name: string, primaryColor = '#146356'): string => {
  const initials = escapeHtml(getInitials(name || 'SR'));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="${primaryColor}"/><text x="32" y="38" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" font-size="22" font-weight="800" fill="#FFFFFF" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const numberToWords = (num: number): string => {
  if (num === 0) return 'Zero Naira Only';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convert = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convert(n % 100) : '');
    if (n < 1000000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 !== 0 ? ' ' + convert(n % 1000000) : '');
    return String(n);
  };

  const wholeNaira = Math.floor(Math.abs(num));
  const kobo = Math.round((Math.abs(num) - wholeNaira) * 100);
  let words = convert(wholeNaira) + ' Naira';
  if (kobo > 0) {
    words += ' and ' + convert(kobo) + ' Kobo';
  }
  return words + ' Only';
};

export const renderReceiptHtml = (
  data: ReceiptRenderData,
  config: ReceiptTemplateConfig,
): string => {
  const { branding, layout, studentInfo, paymentDetails, feeBreakdown, footer } = config;
  const isThermal = layout.paperSize === 'THERMAL_80MM';

  const schoolName = branding.customSchoolName || data.school.name;
  const schoolAddress = branding.customAddress || data.school.address || '';
  const contactText = branding.contactInfoText || [data.school.phone, data.school.email].filter(Boolean).join(' | ');

  const primaryColor = branding.primaryColor || '#1e3a8a';
  const secondaryColor = branding.secondaryColor || '#475569';
  const headerBg = branding.headerBackgroundColor || '#f8fafc';
  const headerText = branding.headerTextColor || '#0f172a';
  const fontFamily = branding.fontFamily || 'Inter, system-ui, -apple-system, sans-serif';

  const amountInWords = numberToWords(data.payment.amount);
  const resolvedLogoUrl = data.school.logoUrl || getDefaultLogoSvg(schoolName, primaryColor);

  if (isThermal) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(data.payment.serialNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      width: 76mm;
      margin: 0 auto;
      padding: 4mm 2mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.3;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 6px 0; }
    .header-logo { max-width: 50px; max-height: 50px; margin: 0 auto 4px; display: block; border-radius: 4px; }
    .title { font-size: 13px; font-weight: bold; margin: 3px 0; text-transform: uppercase; }
    .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
    .items-table { width: 100%; border-collapse: collapse; margin: 4px 0; }
    .items-table th, .items-table td { padding: 2px 0; font-size: 10.5px; }
    .footer { text-align: center; font-size: 10px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="text-center">
    ${branding.showLogo ? `<img src="${escapeHtml(resolvedLogoUrl)}" class="header-logo" alt="Logo" />` : ''}
    ${branding.showSchoolName ? `<div class="bold" style="font-size: 13px;">${escapeHtml(schoolName)}</div>` : ''}
    ${branding.showAddress && schoolAddress ? `<div style="font-size: 10px;">${escapeHtml(schoolAddress)}</div>` : ''}
    ${branding.showContactInfo && contactText ? `<div style="font-size: 9.5px;">${escapeHtml(contactText)}</div>` : ''}
    <div class="title">${escapeHtml(branding.receiptTitle || 'PAYMENT RECEIPT')}</div>
  </div>
  <div class="divider"></div>

  ${paymentDetails.showReceiptNumber ? `<div class="row"><span>${escapeHtml(paymentDetails.receiptNumberLabel)}:</span><span class="bold">${escapeHtml(data.payment.serialNumber)}</span></div>` : ''}
  ${paymentDetails.showDate ? `<div class="row"><span>${escapeHtml(paymentDetails.dateLabel)}:</span><span>${formatDate(data.payment.generatedAt)}</span></div>` : ''}
  ${paymentDetails.showPaymentMethod && data.payment.paymentMethod ? `<div class="row"><span>${escapeHtml(paymentDetails.paymentMethodLabel)}:</span><span>${escapeHtml(data.payment.paymentMethod)}</span></div>` : ''}
  ${paymentDetails.showTransactionReference && data.payment.reference ? `<div class="row"><span>${escapeHtml(paymentDetails.transactionReferenceLabel)}:</span><span style="font-size: 9.5px;">${escapeHtml(data.payment.reference)}</span></div>` : ''}

  <div class="divider"></div>

  ${studentInfo.showStudentName ? `<div class="row"><span>${escapeHtml(studentInfo.studentNameLabel)}:</span><span class="bold">${escapeHtml(data.student.fullName)}</span></div>` : ''}
  ${studentInfo.showAdmissionNumber ? `<div class="row"><span>${escapeHtml(studentInfo.admissionNumberLabel)}:</span><span>${escapeHtml(data.student.admissionNumber)}</span></div>` : ''}
  ${studentInfo.showClass && data.student.className ? `<div class="row"><span>${escapeHtml(studentInfo.classLabel)}:</span><span>${escapeHtml(data.student.className)}</span></div>` : ''}
  ${studentInfo.showGuardianName && data.guardian?.fullName ? `<div class="row"><span>${escapeHtml(studentInfo.guardianNameLabel)}:</span><span>${escapeHtml(data.guardian.fullName)}</span></div>` : ''}

  <div class="divider"></div>

  ${feeBreakdown.showItemsTable && data.items.length > 0 ? `
    <table class="items-table">
      <thead>
        <tr style="border-bottom: 1px dashed #000;">
          <th style="text-align: left;">Item</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${data.items.map((item) => `
          <tr>
            <td>${escapeHtml(item.description)}</td>
            <td style="text-align: right;">${formatCurrency(item.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div class="divider"></div>
  ` : ''}

  ${feeBreakdown.showTotalDue && data.financialSummary.totalDue != null ? `<div class="row"><span>${escapeHtml(feeBreakdown.totalDueLabel)}:</span><span>${formatCurrency(data.financialSummary.totalDue)}</span></div>` : ''}
  ${feeBreakdown.showAmountPaid ? `<div class="row bold" style="font-size: 12px;"><span>${escapeHtml(feeBreakdown.amountPaidLabel)}:</span><span>${formatCurrency(data.payment.amount)}</span></div>` : ''}
  ${paymentDetails.showAmountInWords ? `<div style="font-size: 9.5px; font-style: italic; margin: 3px 0;">(${escapeHtml(amountInWords)})</div>` : ''}
  ${feeBreakdown.showOutstandingBalance && data.financialSummary.outstandingBalance != null ? `<div class="row"><span>${escapeHtml(feeBreakdown.outstandingBalanceLabel)}:</span><span>${formatCurrency(data.financialSummary.outstandingBalance)}</span></div>` : ''}

  <div class="divider"></div>

  ${footer.showNotes && footer.notesText ? `<div class="footer">${escapeHtml(footer.notesText)}</div>` : ''}
  ${footer.showTermsAndConditions && footer.termsText ? `<div class="footer" style="font-size: 9px; margin-top: 4px;">${escapeHtml(footer.termsText)}</div>` : ''}
  <div class="footer bold" style="margin-top: 8px;">*** THANK YOU ***</div>
</body>
</html>`;
  }

  // Standard A4 / A5 Layout
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(data.payment.serialNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${fontFamily};
      color: #1e293b;
      background: #ffffff;
      padding: 30px;
      font-size: 13px;
      line-height: 1.5;
    }
    .receipt-container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 32px;
      background: #ffffff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      position: relative;
    }
    ${layout.showWatermark && layout.watermarkText ? `
      .watermark {
        position: absolute;
        top: 45%;
        left: 50%;
        transform: translate(-50%, -50%) rotate(-30deg);
        font-size: 72px;
        font-weight: 900;
        color: rgba(14, 165, 233, 0.08);
        pointer-events: none;
        z-index: 0;
        text-transform: uppercase;
        letter-spacing: 6px;
      }
    ` : ''}
    .header-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 2px solid ${primaryColor};
      margin-bottom: 24px;
    }
    .branding-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .school-logo {
      width: ${branding.logoWidth || 64}px;
      height: ${branding.logoWidth || 64}px;
      object-fit: contain;
      border-radius: 6px;
    }
    .school-name {
      font-size: 20px;
      font-weight: 800;
      color: ${primaryColor};
      letter-spacing: -0.02em;
    }
    .school-meta {
      font-size: 12px;
      color: ${secondaryColor};
      margin-top: 2px;
    }
    .receipt-title-box {
      text-align: right;
    }
    .receipt-title {
      font-size: 18px;
      font-weight: 800;
      color: ${primaryColor};
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .receipt-number {
      font-size: 14px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
    }
    .receipt-date {
      font-size: 12px;
      color: ${secondaryColor};
    }
    .grid-info {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 24px;
      padding: 16px;
      background: ${headerBg};
      border-radius: 6px;
      border: 1px solid #e2e8f0;
    }
    .info-card h4 {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: ${primaryColor};
      margin-bottom: 8px;
      letter-spacing: 0.05em;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12.5px;
    }
    .info-label {
      color: ${secondaryColor};
    }
    .info-value {
      font-weight: 600;
      color: #0f172a;
    }
    .table-container {
      margin-bottom: 24px;
    }
    .breakdown-table {
      width: 100%;
      border-collapse: collapse;
    }
    .breakdown-table th {
      background: ${feeBreakdown.headerBackgroundColor || '#f1f5f9'};
      color: ${feeBreakdown.headerTextColor || '#0f172a'};
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 10px 14px;
      text-align: left;
      border: 1px solid #e2e8f0;
    }
    .breakdown-table td {
      padding: 10px 14px;
      border: 1px solid #e2e8f0;
      font-size: 12.5px;
    }
    .breakdown-table tr:nth-child(even) {
      background: #f8fafc;
    }
    .summary-card {
      margin-left: auto;
      width: 320px;
      margin-bottom: 24px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .summary-total {
      border-top: 2px solid #e2e8f0;
      margin-top: 6px;
      padding-top: 10px;
      font-size: 15px;
      font-weight: 800;
      color: ${primaryColor};
    }
    .amount-words-box {
      padding: 12px 16px;
      background: #f8fafc;
      border-left: 3px solid ${primaryColor};
      font-size: 12px;
      font-style: italic;
      color: #334155;
      margin-bottom: 24px;
    }
    .footer-section {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .footer-notes {
      max-width: 440px;
      font-size: 11px;
      color: ${secondaryColor};
      line-height: 1.5;
    }
    .signatures-box {
      text-align: center;
      min-width: 180px;
    }
    .signature-line {
      border-bottom: 1px solid #64748b;
      margin-top: 36px;
      margin-bottom: 4px;
    }
    .signature-title {
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      text-transform: uppercase;
    }
    .stamp-img {
      max-height: 55px;
      margin-bottom: -15px;
      opacity: 0.85;
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${layout.showWatermark && layout.watermarkText ? `<div class="watermark">${escapeHtml(layout.watermarkText)}</div>` : ''}

    <!-- Header Section -->
    <div class="header-bar">
      <div class="branding-section">
        ${branding.showLogo ? `<img src="${escapeHtml(resolvedLogoUrl)}" class="school-logo" alt="Logo" />` : ''}
        <div>
          ${branding.showSchoolName ? `<div class="school-name">${escapeHtml(schoolName)}</div>` : ''}
          ${branding.showAddress && schoolAddress ? `<div class="school-meta">${escapeHtml(schoolAddress)}</div>` : ''}
          ${branding.showContactInfo && contactText ? `<div class="school-meta">${escapeHtml(contactText)}</div>` : ''}
        </div>
      </div>
      <div class="receipt-title-box">
        <div class="receipt-title">${escapeHtml(branding.receiptTitle || 'OFFICIAL RECEIPT')}</div>
        ${paymentDetails.showReceiptNumber ? `<div class="receipt-number">${escapeHtml(paymentDetails.receiptNumberLabel)}: ${escapeHtml(data.payment.serialNumber)}</div>` : ''}
        ${paymentDetails.showDate ? `<div class="receipt-date">${escapeHtml(paymentDetails.dateLabel)}: ${formatDate(data.payment.generatedAt)}</div>` : ''}
      </div>
    </div>

    <!-- Student & Payment Information -->
    <div class="grid-info">
      <div class="info-card">
        <h4>Student Details</h4>
        ${studentInfo.showStudentName ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(studentInfo.studentNameLabel)}:</span>
            <span class="info-value">${escapeHtml(data.student.fullName)}</span>
          </div>
        ` : ''}
        ${studentInfo.showAdmissionNumber ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(studentInfo.admissionNumberLabel)}:</span>
            <span class="info-value">${escapeHtml(data.student.admissionNumber)}</span>
          </div>
        ` : ''}
        ${studentInfo.showClass && data.student.className ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(studentInfo.classLabel)}:</span>
            <span class="info-value">${escapeHtml(data.student.className)}</span>
          </div>
        ` : ''}
        ${studentInfo.showGuardianName && data.guardian?.fullName ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(studentInfo.guardianNameLabel)}:</span>
            <span class="info-value">${escapeHtml(data.guardian.fullName)}</span>
          </div>
        ` : ''}
      </div>

      <div class="info-card">
        <h4>Transaction Summary</h4>
        ${paymentDetails.showPaymentMethod && data.payment.paymentMethod ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(paymentDetails.paymentMethodLabel)}:</span>
            <span class="info-value">${escapeHtml(data.payment.paymentMethod)}</span>
          </div>
        ` : ''}
        ${paymentDetails.showTransactionReference && data.payment.reference ? `
          <div class="info-row">
            <span class="info-label">${escapeHtml(paymentDetails.transactionReferenceLabel)}:</span>
            <span class="info-value">${escapeHtml(data.payment.reference)}</span>
          </div>
        ` : ''}
        ${paymentDetails.showBankDetails && data.payment.bankName ? `
          <div class="info-row">
            <span class="info-label">Bank:</span>
            <span class="info-value">${escapeHtml(data.payment.bankName)}</span>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Breakdown Table -->
    ${feeBreakdown.showItemsTable && data.items.length > 0 ? `
      <div class="table-container">
        <table class="breakdown-table">
          <thead>
            <tr>
              <th style="width: 50%;">Fee Description</th>
              <th style="text-align: right; width: 25%;">Billed</th>
              <th style="text-align: right; width: 25%;">Amount Paid</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.description)}</strong></td>
                <td style="text-align: right;">${formatCurrency(item.amount)}</td>
                <td style="text-align: right; font-weight: 600;">${formatCurrency(item.amountPaid ?? item.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- Financial Totals -->
    <div class="summary-card">
      ${feeBreakdown.showTotalDue && data.financialSummary.totalDue != null ? `
        <div class="summary-row">
          <span class="info-label">${escapeHtml(feeBreakdown.totalDueLabel)}:</span>
          <span class="info-value">${formatCurrency(data.financialSummary.totalDue)}</span>
        </div>
      ` : ''}
      ${feeBreakdown.showAmountPaid ? `
        <div class="summary-row summary-total">
          <span>${escapeHtml(feeBreakdown.amountPaidLabel)}:</span>
          <span>${formatCurrency(data.payment.amount)}</span>
        </div>
      ` : ''}
      ${feeBreakdown.showOutstandingBalance && data.financialSummary.outstandingBalance != null ? `
        <div class="summary-row" style="color: ${data.financialSummary.outstandingBalance > 0 ? '#b91c1c' : '#15803d'}; font-weight: 600;">
          <span>${escapeHtml(feeBreakdown.outstandingBalanceLabel)}:</span>
          <span>${formatCurrency(data.financialSummary.outstandingBalance)}</span>
        </div>
      ` : ''}
    </div>

    <!-- Amount in Words -->
    ${paymentDetails.showAmountInWords ? `
      <div class="amount-words-box">
        <strong>Amount in words:</strong> ${escapeHtml(amountInWords)}
      </div>
    ` : ''}

    <!-- Footer & Signatures -->
    <div class="footer-section">
      <div class="footer-notes">
        ${footer.showNotes && footer.notesText ? `<p><strong>${escapeHtml(footer.notesTitle || 'Note')}:</strong> ${escapeHtml(footer.notesText)}</p>` : ''}
        ${footer.showTermsAndConditions && footer.termsText ? `<p style="margin-top: 6px;">${escapeHtml(footer.termsText)}</p>` : ''}
      </div>

      <div class="signatures-box">
        ${footer.showStamp && data.school.stampUrl ? `
          <img src="${escapeHtml(data.school.stampUrl)}" class="stamp-img" alt="Stamp" />
        ` : ''}
        <div class="signature-line"></div>
        <div class="signature-title">${escapeHtml(footer.signatureTitle || 'Authorized Signature')}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
