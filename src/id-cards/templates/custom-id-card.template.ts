import { RenderCardContext, StudentCardData, StaffCardData } from './id-card-data.interface';
import {
  escapeHtml,
  sanitizeUrl,
  optimizeCardPhotoUrl,
  getDefaultAvatarSvg,
  getDefaultLogoSvg,
} from './template-helpers';
import { IdCardOrientation, IdCardType } from '../enums/id-card.enums';

export interface IdCardCustomDesign {
  theme?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  showSchoolName?: boolean;
  customSchoolName?: string;
  showLogo?: boolean;
  logoWidthMm?: number;
  showPhoto?: boolean;
  photoShape?: 'rectangle' | 'rounded' | 'circle';
  photoBorderColor?: string;
  showAdmissionNumber?: boolean;
  admissionNumberLabel?: string;
  showClass?: boolean;
  classLabel?: string;
  showStaffId?: boolean;
  staffIdLabel?: string;
  showDesignation?: boolean;
  designationLabel?: string;
  showGender?: boolean;
  showEmergencyContact?: boolean;
  emergencyContactText?: string;
  showIssueDate?: boolean;
  showExpiryDate?: boolean;
  expiryDateText?: string;
  backBackgroundColor?: string;
  backTextColor?: string;
  showTerms?: boolean;
  termsText?: string;
  showAddress?: boolean;
  customAddress?: string;
  showPrincipalSignature?: boolean;
  signatureTitle?: string;
  signatureUrl?: string;
  showStamp?: boolean;
  stampUrl?: string;
  showBarcodeOrQr?: boolean;
  barcodeOrQrType?: 'QR' | 'BARCODE' | 'NONE';
}

export const parseDesignConfiguration = (raw?: string | null): IdCardCustomDesign => {
  if (!raw) return {};
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return {};
  }
};

export const renderCustomIdCardFront = (
  ctx: RenderCardContext<StudentCardData | StaffCardData>,
  design: IdCardCustomDesign = {},
  orientation: IdCardOrientation = IdCardOrientation.PORTRAIT,
  cardType: IdCardType = IdCardType.STUDENT,
): string => {
  const { school, cardData } = ctx;
  const isLandscape = orientation === IdCardOrientation.LANDSCAPE;
  const widthMm = isLandscape ? 85.6 : 53.98;
  const heightMm = isLandscape ? 53.98 : 85.6;

  const primaryColor = design.primaryColor || school.primaryColor || '#146356';
  const secondaryColor = design.secondaryColor || '#0B3830';
  const accentColor = design.accentColor || '#C89D3C';
  const bgColor = design.backgroundColor || '#FFFFFF';
  const textColor = design.textColor || '#14201C';
  const fontFamily = design.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const schoolName = escapeHtml(design.customSchoolName || school.name || 'SchoolRight');
  const cardTitle = cardType === IdCardType.STAFF ? 'Staff Identity Card' : 'Student Identity Card';

  const logoSrc = school.logoUrl
    ? sanitizeUrl(school.logoUrl)
    : getDefaultLogoSvg(school.name || 'SP');

  const rawPhotoUrl = (cardData as StudentCardData).passportPhotoUrl || (cardData as StaffCardData).avatarUrl;
  const photoSrc = rawPhotoUrl
    ? sanitizeUrl(optimizeCardPhotoUrl(rawPhotoUrl))
    : getDefaultAvatarSvg(cardData.fullName);

  const fullName = escapeHtml(cardData.fullName);
  const identifierLabel = cardType === IdCardType.STAFF
    ? (design.staffIdLabel || 'Staff ID')
    : (design.admissionNumberLabel || 'Admission No');
  const identifierValue = cardType === IdCardType.STAFF
    ? escapeHtml((cardData as StaffCardData).staffId || '—')
    : escapeHtml((cardData as StudentCardData).admissionNumber || '—');

  const classOrRoleLabel = cardType === IdCardType.STAFF
    ? (design.designationLabel || 'Designation')
    : (design.classLabel || 'Class');
  const classOrRoleValue = cardType === IdCardType.STAFF
    ? escapeHtml((cardData as StaffCardData).designation || (cardData as StaffCardData).role || 'Staff')
    : escapeHtml((cardData as StudentCardData).className || 'Unassigned');

  const photoBorderRadius = design.photoShape === 'circle'
    ? '50%'
    : design.photoShape === 'rounded'
    ? '2.5mm'
    : '1mm';

  return `
    <div class="custom-card-front" style="
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      box-sizing: border-box;
      background: ${bgColor};
      color: ${textColor};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      overflow: hidden;
      font-family: ${fontFamily};
      border-radius: 2mm;
    ">
      <!-- Header Banner -->
      <div style="
        background: ${primaryColor};
        color: #FFFFFF;
        padding: 2.5mm 3mm;
        display: flex;
        align-items: center;
        gap: 2mm;
        border-bottom: 0.6mm solid ${accentColor};
      ">
        <img src="${logoSrc}" alt="Logo" style="
          width: 7.5mm;
          height: 7.5mm;
          object-fit: contain;
          border-radius: 1mm;
          background: #FFFFFF;
          padding: 0.4mm;
          flex-shrink: 0;
        " />
        <div style="min-width: 0; flex: 1;">
          <div style="
            font-size: 2.6mm;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.1;
          ">${schoolName}</div>
          <div style="
            font-size: 1.6mm;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.9;
            margin-top: 0.3mm;
          ">${cardTitle}</div>
        </div>
      </div>

      <!-- Main Body Area -->
      <div style="
        flex: 1;
        padding: 2.5mm 3mm;
        display: flex;
        flex-direction: ${isLandscape ? 'row' : 'column'};
        align-items: center;
        justify-content: center;
        gap: 2.5mm;
      ">
        <!-- Photo -->
        <div style="
          width: ${isLandscape ? '22mm' : '20mm'};
          height: ${isLandscape ? '25mm' : '23mm'};
          border-radius: ${photoBorderRadius};
          overflow: hidden;
          border: 0.6mm solid ${design.photoBorderColor || primaryColor};
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          flex-shrink: 0;
          background: #f1f5f9;
        ">
          <img src="${photoSrc}" alt="${fullName}" style="
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
          " />
        </div>

        <!-- Info Fields -->
        <div style="
          flex: 1;
          min-width: 0;
          text-align: ${isLandscape ? 'left' : 'center'};
          width: 100%;
        ">
          <div style="
            font-size: 2.6mm;
            font-weight: 800;
            color: ${textColor};
            line-height: 1.2;
            margin-bottom: 1.2mm;
            text-transform: uppercase;
          ">${fullName}</div>

          <div style="
            display: inline-block;
            background: ${primaryColor};
            color: #FFFFFF;
            font-size: 1.7mm;
            font-weight: 700;
            padding: 0.5mm 2mm;
            border-radius: 1mm;
            margin-bottom: 1.5mm;
            letter-spacing: 0.05em;
          ">${identifierLabel}: ${identifierValue}</div>

          <div style="font-size: 1.8mm; margin-bottom: 0.5mm; color: #475569;">
            <span style="font-weight: 600;">${classOrRoleLabel}:</span>
            <span style="font-weight: 700; color: ${textColor};">${classOrRoleValue}</span>
          </div>

          ${(cardData as StudentCardData).gender ? `
            <div style="font-size: 1.6mm; color: #64748b;">
              Gender: <span style="font-weight: 600; color: ${textColor};">${escapeHtml((cardData as StudentCardData).gender)}</span>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Bottom Accent Footer -->
      <div style="
        background: ${secondaryColor};
        color: #FFFFFF;
        padding: 1.2mm 3mm;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 1.4mm;
        font-weight: 600;
        letter-spacing: 0.05em;
      ">
        <span>SCHOOLRIGHT SECURE ID</span>
        <span style="color: ${accentColor};">OFFICIAL CREDENTIAL</span>
      </div>
    </div>
  `;
};

export const renderCustomIdCardBack = (
  ctx: RenderCardContext<StudentCardData | StaffCardData>,
  design: IdCardCustomDesign = {},
  orientation: IdCardOrientation = IdCardOrientation.PORTRAIT,
): string => {
  const { school, options } = ctx;
  const isLandscape = orientation === IdCardOrientation.LANDSCAPE;
  const widthMm = isLandscape ? 85.6 : 53.98;
  const heightMm = isLandscape ? 53.98 : 85.6;

  const primaryColor = design.primaryColor || school.primaryColor || '#146356';
  const bgColor = design.backBackgroundColor || '#F8FAFC';
  const textColor = design.backTextColor || '#1E293B';
  const fontFamily = design.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const schoolAddress = escapeHtml(design.customAddress || school.address || 'School Premises');
  const termsText = escapeHtml(
    design.termsText ||
      options.customNote ||
      'This identity card is the property of the school. If found, please return to the school administration office or contact school security immediately.'
  );

  return `
    <div class="custom-card-back" style="
      width: ${widthMm}mm;
      height: ${heightMm}mm;
      box-sizing: border-box;
      background: ${bgColor};
      color: ${textColor};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 3mm;
      position: relative;
      overflow: hidden;
      font-family: ${fontFamily};
      border-radius: 2mm;
      font-size: 1.6mm;
      line-height: 1.3;
    ">
      <!-- Terms and Conditions -->
      <div>
        <div style="
          font-size: 1.8mm;
          font-weight: 800;
          text-transform: uppercase;
          color: ${primaryColor};
          margin-bottom: 1.2mm;
          letter-spacing: 0.05em;
          border-bottom: 0.3mm solid #cbd5e1;
          padding-bottom: 0.5mm;
        ">Terms & Conditions</div>
        <p style="color: #475569; font-size: 1.5mm; margin: 0 0 2mm;">${termsText}</p>
        ${options.showSchoolAddress && schoolAddress ? `
          <div style="font-size: 1.4mm; color: #64748b; margin-top: 1mm;">
            <strong>Address:</strong> ${schoolAddress}
          </div>
        ` : ''}
      </div>

      <!-- QR / Barcode & Signatures Area -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        padding-top: 2mm;
        border-top: 0.3mm solid #cbd5e1;
      ">
        ${options.showQrCode && options.qrCodeDataUrl ? `
          <div style="text-align: center;">
            <img src="${options.qrCodeDataUrl}" alt="QR" style="
              width: 13mm;
              height: 13mm;
              display: block;
              border: 0.3mm solid #e2e8f0;
              background: #FFFFFF;
              padding: 0.4mm;
            " />
            <div style="font-size: 1.2mm; color: #64748b; margin-top: 0.3mm;">VERIFY ID</div>
          </div>
        ` : '<div></div>'}

        ${options.showPrincipalSignature ? `
          <div style="text-align: center; min-width: 22mm;">
            ${school.stampUrl ? `
              <img src="${sanitizeUrl(school.stampUrl)}" alt="Stamp" style="
                max-height: 8mm;
                margin-bottom: -3mm;
                opacity: 0.8;
                display: block;
                margin-left: auto;
                margin-right: auto;
              " />
            ` : ''}
            <div style="border-bottom: 0.4mm solid #475569; width: 22mm; margin: 0 auto 0.5mm;"></div>
            <div style="font-size: 1.3mm; font-weight: 700; text-transform: uppercase; color: #334155;">
              ${escapeHtml(design.signatureTitle || 'Authorized Signature')}
            </div>
          </div>
        ` : ''}
      </div>
    </div>
  `;
};
