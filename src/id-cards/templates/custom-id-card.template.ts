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
    : design.photoShape === 'rectangle'
    ? '1mm'
    : '2mm';

  const showPhoto = design.showPhoto !== false;
  const showLogo = design.showLogo !== false;
  const showSchoolName = design.showSchoolName !== false;

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
      border-radius: 2.2mm;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06);
      border: 0.25mm solid #E2E8F0;
    ">
      <!-- Header Banner -->
      <div style="
        background: ${primaryColor};
        color: #FFFFFF;
        padding: 2.2mm 2.8mm;
        display: flex;
        align-items: center;
        gap: 2mm;
        border-bottom: 0.6mm solid ${accentColor};
        flex-shrink: 0;
      ">
        ${showLogo ? `
          <img src="${logoSrc}" alt="Logo" style="
            width: 8.5mm;
            height: 8.5mm;
            object-fit: contain;
            border-radius: 1mm;
            background: #FFFFFF;
            padding: 0.4mm;
            flex-shrink: 0;
          " />
        ` : ''}
        <div style="min-width: 0; flex: 1;">
          ${showSchoolName ? `
            <div style="
              font-size: 2.3mm;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.03em;
              line-height: 1.15;
              max-height: 5.6mm;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              white-space: normal;
            ">${schoolName}</div>
          ` : ''}
          <div style="
            font-size: 1.5mm;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            opacity: 0.95;
            margin-top: 0.3mm;
          ">${cardTitle}</div>
        </div>
      </div>

      <!-- Main Body Area -->
      <div style="
        flex: 1;
        padding: ${isLandscape ? '2.5mm 3.5mm' : '2.2mm 3.2mm 2mm'};
        display: flex;
        flex-direction: ${isLandscape ? 'row' : 'column'};
        align-items: center;
        justify-content: space-between;
        gap: ${isLandscape ? '3.5mm' : '1.2mm'};
        box-sizing: border-box;
        overflow: hidden;
        min-height: 0;
      ">
        ${showPhoto ? `
          <!-- Photo Container -->
          <div style="
            width: ${isLandscape ? '24mm' : '25mm'};
            height: ${isLandscape ? '28mm' : '29mm'};
            border-radius: ${photoBorderRadius};
            overflow: hidden;
            border: 0.7mm solid ${design.photoBorderColor || primaryColor};
            box-shadow: 0 2px 5px rgba(0,0,0,0.12);
            flex-shrink: 0;
            background: #F1F5F9;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <img src="${photoSrc}" alt="${fullName}" style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              display: block;
            " />
          </div>
        ` : ''}

        <!-- Info Fields Area -->
        <div style="
          flex: 1;
          min-width: 0;
          width: 100%;
          text-align: ${isLandscape ? 'left' : 'center'};
          display: flex;
          flex-direction: column;
          align-items: ${isLandscape ? 'flex-start' : 'center'};
          justify-content: ${isLandscape ? 'center' : 'space-between'};
        ">
          <!-- Full Name -->
          <div style="
            font-size: 2.9mm;
            font-weight: 800;
            color: ${textColor};
            line-height: 1.15;
            text-transform: uppercase;
            letter-spacing: 0.02em;
            max-height: 6.8mm;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            margin-bottom: 0.8mm;
            width: 100%;
          ">${fullName}</div>

          <!-- Class / Role Badge -->
          <div style="
            display: inline-block;
            background: ${primaryColor};
            color: #FFFFFF;
            font-size: 1.7mm;
            font-weight: 700;
            padding: 0.5mm 2.2mm;
            border-radius: 0.8mm;
            margin-bottom: 1.2mm;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            max-width: 95%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${classOrRoleValue}</div>

          <!-- Structured Credential Box -->
          <div style="
            width: 100%;
            background: #F8FAFC;
            border: 0.25mm solid #E2E8F0;
            border-radius: 1mm;
            padding: 1.4mm 2mm;
            box-sizing: border-box;
            font-size: 1.6mm;
            line-height: 1.35;
          ">
            ${(design.showAdmissionNumber ?? true) ? `
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6mm;">
                <span style="font-weight: 600; color: #64748B; text-transform: uppercase; font-size: 1.5mm;">${identifierLabel}:</span>
                <span style="font-weight: 700; font-family: monospace; color: #0F172A; font-size: 1.6mm;">${identifierValue}</span>
              </div>
            ` : ''}

            ${(design.showGender ?? true) && (cardData as StudentCardData).gender ? `
              <div style="display: flex; justify-content: space-between; align-items: center; ${(cardData as StudentCardData).sessionName ? 'margin-bottom: 0.6mm;' : ''}">
                <span style="font-weight: 600; color: #64748B; text-transform: uppercase; font-size: 1.5mm;">Gender:</span>
                <span style="font-weight: 700; color: #0F172A; font-size: 1.6mm;">${escapeHtml((cardData as StudentCardData).gender)}</span>
              </div>
            ` : ''}

            ${(cardData as StudentCardData).sessionName ? `
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; color: #64748B; text-transform: uppercase; font-size: 1.5mm;">Session:</span>
                <span style="font-weight: 700; color: #0F172A; font-size: 1.6mm;">${escapeHtml((cardData as StudentCardData).sessionName)}</span>
              </div>
            ` : ''}
          </div>
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
        font-weight: 700;
        letter-spacing: 0.05em;
        flex-shrink: 0;
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
  const secondaryColor = design.secondaryColor || '#0B3830';
  const accentColor = design.accentColor || '#C89D3C';
  const bgColor = design.backBackgroundColor || '#F8FAFC';
  const textColor = design.backTextColor || '#1E293B';
  const fontFamily = design.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  const schoolName = escapeHtml(design.customSchoolName || school.name || 'SchoolRight');
  const schoolAddress = escapeHtml(design.customAddress || school.address || 'School Premises');
  const termsText = escapeHtml(
    design.termsText ||
      options.customNote ||
      'This identity card is the official property of the school. If found, please return to the school administration office or contact school security immediately.'
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
      position: relative;
      overflow: hidden;
      font-family: ${fontFamily};
      border-radius: 2.2mm;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.06);
      border: 0.25mm solid #E2E8F0;
      font-size: 1.6mm;
      line-height: 1.35;
    ">
      <!-- Back Header Banner -->
      <div style="
        background: ${primaryColor};
        color: #FFFFFF;
        padding: 2mm 3mm;
        font-size: 1.6mm;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 0.5mm solid ${accentColor};
        flex-shrink: 0;
      ">
        <span>${schoolName}</span>
        <span style="opacity: 0.9; font-size: 1.35mm;">Terms & Verification</span>
      </div>

      <!-- Main Back Body Area -->
      <div style="
        flex: 1;
        padding: 2.5mm 3.2mm;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-sizing: border-box;
      ">
        <!-- Terms and Institutional Instructions -->
        <div>
          <div style="
            font-size: 1.7mm;
            font-weight: 800;
            text-transform: uppercase;
            color: ${primaryColor};
            margin-bottom: 1mm;
            letter-spacing: 0.04em;
          ">Cardholder Terms</div>
          <p style="color: #475569; font-size: 1.45mm; line-height: 1.35; margin: 0 0 1.5mm;">
            ${termsText}
          </p>

          <!-- Campus and Emergency Info Box -->
          <div style="
            background: #FFFFFF;
            border: 0.25mm solid #E2E8F0;
            border-radius: 0.8mm;
            padding: 1.2mm 2mm;
            font-size: 1.4mm;
            color: #334155;
            line-height: 1.3;
          ">
            ${(design.showAddress !== false) && schoolAddress ? `
              <div><strong>Campus:</strong> ${schoolAddress}</div>
            ` : ''}
            ${school.phone ? `
              <div style="margin-top: 0.3mm;"><strong>Emergency Contact:</strong> ${escapeHtml(school.phone)}</div>
            ` : ''}
            ${school.email ? `
              <div style="margin-top: 0.3mm;"><strong>Email:</strong> ${escapeHtml(school.email)}</div>
            ` : ''}
          </div>
        </div>

        <!-- QR / Barcode & Signatures Area -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 1.5mm;
          border-top: 0.3mm solid #E2E8F0;
          margin-top: 1.5mm;
        ">
          ${(design.showBarcodeOrQr !== false) && options.qrCodeDataUrl ? `
            <div style="text-align: center;">
              <img src="${options.qrCodeDataUrl}" alt="QR" style="
                width: 14mm;
                height: 14mm;
                display: block;
                border: 0.25mm solid #CBD5E1;
                background: #FFFFFF;
                padding: 0.4mm;
                border-radius: 0.6mm;
              " />
              <div style="font-size: 1.2mm; font-weight: 700; color: #64748B; margin-top: 0.4mm; letter-spacing: 0.04em;">SCAN TO VERIFY</div>
            </div>
          ` : '<div></div>'}

          ${(design.showPrincipalSignature !== false) ? `
            <div style="text-align: center; min-width: 24mm;">
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
              <div style="border-bottom: 0.4mm solid #475569; width: 24mm; margin: 0 auto 0.5mm;"></div>
              <div style="font-size: 1.3mm; font-weight: 700; text-transform: uppercase; color: #334155; letter-spacing: 0.02em;">
                ${escapeHtml(design.signatureTitle || 'Authorized Signature')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- Bottom Security Strip -->
      <div style="
        background: ${secondaryColor};
        color: #94A3B8;
        padding: 1mm 3mm;
        text-align: center;
        font-size: 1.2mm;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        flex-shrink: 0;
      ">
        Non-transferable &bull; Official Institutional Credential
      </div>
    </div>
  `;
};
