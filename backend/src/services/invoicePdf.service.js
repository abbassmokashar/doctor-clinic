/**
 * Invoice PDF Generator
 *
 * Generates a PDF of the invoice using Chrome's built-in --print-to-pdf
 * headless mode. Chrome must be installed — we use the same path as the
 * WhatsApp service (C:\Program Files\Google\Chrome\Application\chrome.exe).
 *
 * No npm package dependency required.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Chrome executable — use the same path as whatsapp-web.js
const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/**
 * Generate a PDF of an invoice HTML document.
 *
 * @param {string} html - Complete HTML document string for the invoice
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePdf(html) {
  // Write HTML to a temp file
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-pdf-'));
  const htmlPath = path.join(tmpDir, 'invoice.html');
  const pdfPath = path.join(tmpDir, 'invoice.pdf');

  try {
    fs.writeFileSync(htmlPath, html, 'utf-8');

    // Use Chrome headless to print to PDF
    await new Promise((resolve, reject) => {
      const args = [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        `--print-to-pdf=${pdfPath}`,
        `file:///${htmlPath.replace(/\\/g, '/')}`,
      ];

      execFile(CHROME_PATH, args, {
        timeout: 30000,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          // Chrome sometimes exits with non-zero even on success — check if PDF was created
          if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).size > 0) {
            resolve();
          } else {
            reject(new Error(`Chrome PDF generation failed: ${error.message}`));
          }
        } else {
          resolve();
        }
      });
    });

    // Read the PDF
    const pdfBuffer = fs.readFileSync(pdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temp files
    try {
      if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
      if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      if (fs.existsSync(tmpDir)) fs.rmdirSync(tmpDir);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Build the full invoice HTML document string from invoice data and settings.
 * Matches the same visual template as the frontend InvoicePrint component.
 */
function buildInvoiceHtml(invoice, settings = {}) {
  const {
    appName = 'Doctor Clinic',
    clinicSubtitle = 'Healthcare &bull; Medical Center',
    invoiceClinicAddress = '',
    invoiceClinicPhone = '',
    invoiceClinicEmail = '',
    invoiceTaxId = '',
    invoiceFooter = '',
    logoUrl: rawLogoUrl = '',
    logoStyle = '',
  } = settings;

  // Resolve relative logo URL to an absolute file:/// path so Chrome headless
  // (which opens the HTML from a local temp file) can load the image from disk.
  // The stored logoUrl is a web-relative path like '/uploads/logo/logo-xxx.png'
  // which works in the browser but not when rendering from file:///.
  let logoUrl = rawLogoUrl;
  if (logoUrl && logoUrl.startsWith('/')) {
    const absolutePath = path.resolve(__dirname, '../..', logoUrl.slice(1));
    if (fs.existsSync(absolutePath)) {
      logoUrl = `file:///${absolutePath.replace(/\\/g, '/')}`;
    }
  }

  const patient = invoice.patient || {};
  const installments = invoice.installments || [];
  const isInstallment = invoice.isInstallment;
  const totalPaid = invoice.paidAmount || 0;
  const balance = (invoice.amount || 0) - totalPaid;
  const paidInstallments = installments.filter((i) => i.status === 'PAID');
  const pendingInstallments = installments.filter((i) => i.status === 'PENDING');

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount) => `$${(amount || 0).toFixed(2)}`;
  const padId = (id) => `#${String(id || '').padStart(5, '0')}`;
  const inst = invoice._singleInstallment || null;
  const isSingle = !!inst;

  // --- Clinic Info Block ---
  let clinicInfoHtml = '';
  const clinicLines = [];
  if (invoiceClinicAddress) clinicLines.push(`<p style="font-size:12px;margin-bottom:2px;">📍 ${invoiceClinicAddress}</p>`);
  if (invoiceClinicPhone) clinicLines.push(`<p style="font-size:12px;margin-bottom:2px;">📞 ${invoiceClinicPhone}</p>`);
  if (invoiceClinicEmail) clinicLines.push(`<p style="font-size:12px;margin-bottom:2px;">✉️ ${invoiceClinicEmail}</p>`);
  if (invoiceTaxId) clinicLines.push(`<p style="font-size:12px;margin-bottom:2px;">🏷️ Tax ID: ${invoiceTaxId}</p>`);
  if (clinicLines.length > 0) {
    clinicInfoHtml = `
      <div class="section-title">Clinic Information</div>
      <div class="desc-block">
        ${clinicLines.join('')}
      </div>`;
  }

  // --- Installment Schedule HTML ---
  let installmentsHtml = '';
  if (isSingle) {
    installmentsHtml = `
      <div class="section-title">Installment Plan Summary</div>
      <div class="installments-section">
        <div class="installments-grid">
          ${installments.map((i, idx) => {
            const isThis = i.id === inst.id || i.orderIndex === inst.orderIndex;
            return `
            <div class="installment-item ${i.status === 'PAID' ? 'paid' : 'pending'} ${isThis ? 'highlight' : ''}">
              <div class="installment-left">
                <div class="installment-num">${idx + 1}</div>
                <div>
                  <div class="installment-amount">${formatCurrency(i.amount)}</div>
                  <div class="installment-date">Due: ${formatDate(i.dueDate)}${i.paidAt ? ` &middot; Paid: ${formatDate(i.paidAt)}` : ''}</div>
                </div>
              </div>
              <div class="installment-status ${i.status === 'PAID' ? 'paid' : 'pending'}">
                ${isThis ? '▼ This installment' : (i.status === 'PAID' ? 'Paid' : 'Pending')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  } else if (isInstallment && installments.length > 0) {
    installmentsHtml = `
      <div class="section-title">Installment Schedule</div>
      <div class="installments-section">
        <div class="installments-grid">
          ${installments.map((i, idx) => `
            <div class="installment-item ${i.status === 'PAID' ? 'paid' : 'pending'}">
              <div class="installment-left">
                <div class="installment-num">${idx + 1}</div>
                <div>
                  <div class="installment-amount">${formatCurrency(i.amount)}</div>
                  <div class="installment-date">Due: ${formatDate(i.dueDate)}${i.paidAt ? ` &middot; Paid: ${formatDate(i.paidAt)}` : ''}</div>
                </div>
              </div>
              <div class="installment-status ${i.status === 'PAID' ? 'paid' : 'pending'}">
                ${i.status === 'PAID' ? 'Paid' : 'Pending'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // --- Footer ---
  const footerLines = invoiceFooter
    ? invoiceFooter.split('\n').map((l) => l.trim()).filter(Boolean)
    : ['Thank you for choosing us for your healthcare needs.', 'This is a computer-generated invoice and does not require a physical signature.'];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${padId(invoice.id)} - ${appName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a2e;
      background: #fff;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .invoice-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
    }
    .invoice-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 36px 44px 28px;
      color: #fff;
    }
    .invoice-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .clinic-brand { display: flex; align-items: center; gap: 14px; }
    .clinic-logo-img { height: 44px; width: auto; border-radius: 8px; }
    .clinic-icon {
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px;
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
    }
    .clinic-icon svg { width: 26px; height: 26px; color: #fff; }
    .clinic-name { font-size: 19px; font-weight: 700; letter-spacing: -0.3px; color: #fff; }
    .clinic-sub { font-size: 11px; color: rgba(255,255,255,0.6); letter-spacing: 0.5px; text-transform: uppercase; margin-top: 2px; }
    .invoice-badge { text-align: right; }
    .invoice-badge h1 { font-size: 26px; font-weight: 700; letter-spacing: 2px; color: rgba(255,255,255,0.9); }
    .invoice-badge p { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px; }
    .status-badge {
      display: inline-block; padding: 3px 12px; border-radius: 20px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;
      margin-top: 6px;
    }
    .status-PAID { background: #059669; color: #fff; }
    .status-PARTIALLY_PAID { background: #2563eb; color: #fff; }
    .status-PENDING { background: #d97706; color: #fff; }
    .status-CANCELLED { background: #dc2626; color: #fff; }
    .status-REFUNDED { background: #7c3aed; color: #fff; }

    .invoice-meta-row {
      display: flex; justify-content: space-between;
      margin-top: 20px; padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.12);
    }
    .meta-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: rgba(255,255,255,0.4); margin-bottom: 3px; }
    .meta-value { font-size: 13px; font-weight: 600; color: #fff; }

    .invoice-body { padding: 28px 44px; }
    .section-title { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; margin-bottom: 10px; }

    .patient-info {
      background: #f8fafc; border-radius: 10px; padding: 16px 20px;
      margin-bottom: 20px; border: 1px solid #e2e8f0;
    }
    .patient-name { font-size: 16px; font-weight: 700; color: #1a1a2e; }
    .patient-details { display: flex; gap: 20px; margin-top: 6px; font-size: 12px; color: #64748b; }
    .patient-details span { display: flex; align-items: center; gap: 5px; }
    .patient-details .label { color: #94a3b8; font-size: 10px; }

    .desc-block {
      background: #f8fafc; border-radius: 10px; padding: 14px 18px;
      margin-bottom: 20px; border: 1px solid #e2e8f0;
    }
    .desc-block p { font-size: 13px; line-height: 1.5; color: #334155; }

    .amount-section { margin-bottom: 20px; }
    .amount-table { width: 100%; border-collapse: collapse; }
    .amount-table td { padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .amount-table td:last-child { text-align: right; font-weight: 600; }
    .amount-table .label-cell { color: #64748b; }
    .amount-table .total-row td {
      padding-top: 12px; border-top: 2px solid #1a1a2e; border-bottom: none;
      font-size: 15px; font-weight: 700; color: #1a1a2e;
    }
    .amount-table .paid-row td { color: #059669; }
    .amount-table .balance-row td { color: ${balance > 0 ? '#d97706' : '#059669'}; font-weight: 700; font-size: 14px; }
    .amount-table .balance-row td:last-child { font-size: 16px; }

    .installments-section { margin-bottom: 20px; }
    .installments-grid { display: grid; gap: 6px; }
    .installment-item {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 14px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12px;
    }
    .installment-item.paid { background: #f0fdf4; border-color: #bbf7d0; }
    .installment-item.pending { background: #fffbeb; border-color: #fde68a; }
    .installment-item.highlight { border-width: 2px; }
    .installment-item.highlight.paid { border-color: #059669; box-shadow: 0 0 0 2px rgba(5, 150, 105, 0.2); }
    .installment-item.highlight.pending { border-color: #d97706; box-shadow: 0 0 0 2px rgba(217, 119, 6, 0.2); }
    .installment-left { display: flex; align-items: center; gap: 10px; }
    .installment-num {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%;
      font-size: 11px; font-weight: 700; background: #e2e8f0; color: #64748b;
    }
    .installment-item.paid .installment-num { background: #bbf7d0; color: #059669; }
    .installment-amount { font-weight: 600; color: #1a1a2e; }
    .installment-date { color: #94a3b8; font-size: 11px; }
    .installment-status { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .installment-status.paid { background: #bbf7d0; color: #059669; }
    .installment-status.pending { background: #fde68a; color: #92400e; }

    .invoice-footer {
      padding: 20px 44px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer-text { font-size: 10px; color: #94a3b8; line-height: 1.7; }
    .footer-text strong { color: #64748b; }

    @page { margin: 10mm 8mm; }
    @media print {
      body { background: #fff; }
      .invoice-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .installment-item { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header -->
    <div class="invoice-header">
      <div class="invoice-header-top">
        <div class="clinic-brand">
          ${logoUrl && logoStyle === 'image' ? `
            <img src="${logoUrl}" alt="Logo" class="clinic-logo-img" />
          ` : `
            <div class="clinic-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
          `}
          <div>
            <div class="clinic-name">${appName}</div>
            <div class="clinic-sub">${clinicSubtitle}</div>
          </div>
        </div>
        <div class="invoice-badge">
          <h1>${isSingle ? 'INSTALLMENT' : 'INVOICE'}</h1>
          <p>${isSingle ? `${padId(invoice.id)} / Inst. ${inst?.orderIndex}` : padId(invoice.id)}</p>
          <span class="status-badge status-${isSingle ? (inst?.status === 'PAID' ? 'PAID' : 'PENDING') : invoice.status}">
            ${isSingle ? (inst?.status === 'PAID' ? 'Paid' : 'Pending') : (invoice.status || 'PENDING').replace('_', ' ')}
          </span>
        </div>
      </div>
      <div class="invoice-meta-row">
        ${isSingle ? `
        <div class="meta-item"><div class="meta-label">Installment</div><div class="meta-value">${inst?.orderIndex} of ${installments.length}</div></div>
        <div class="meta-item"><div class="meta-label">Invoice</div><div class="meta-value">${padId(invoice.id)}</div></div>
        <div class="meta-item"><div class="meta-label">Due Date</div><div class="meta-value">${formatDate(inst?.dueDate)}</div></div>
        ${inst?.paidAt ? `<div class="meta-item"><div class="meta-label">Paid Date</div><div class="meta-value">${formatDate(inst?.paidAt)}</div></div>` : ''}
        ` : `
        <div class="meta-item"><div class="meta-label">Invoice Date</div><div class="meta-value">${formatDate(invoice.createdAt)}</div></div>
        ${invoice.dueDate ? `<div class="meta-item"><div class="meta-label">Due Date</div><div class="meta-value">${formatDate(invoice.dueDate)}</div></div>` : ''}
        ${invoice.paidAt ? `<div class="meta-item"><div class="meta-label">Paid Date</div><div class="meta-value">${formatDate(invoice.paidAt)}</div></div>` : ''}
        ${isInstallment ? `<div class="meta-item"><div class="meta-label">Payment Plan</div><div class="meta-value">${paidInstallments.length}/${installments.length} Paid</div></div>` : `
        <div class="meta-item"><div class="meta-label">Payment Type</div><div class="meta-value">One-time Payment</div></div>`}
        `}
      </div>
    </div>

    <!-- Body -->
    <div class="invoice-body">
      <!-- Patient Info -->
      <div class="patient-info">
        <div class="patient-name">${patient.firstName || ''} ${patient.lastName || ''}</div>
        <div class="patient-details">
          ${patient.phone ? `<span><span class="label">Phone:</span> ${patient.phone}</span>` : ''}
          ${patient.email ? `<span><span class="label">Email:</span> ${patient.email}</span>` : ''}
        </div>
      </div>

      <!-- Clinic Info -->
      ${clinicInfoHtml}

      <!-- Description -->
      ${invoice.description ? `
      <div class="section-title">Service Description</div>
      <div class="desc-block"><p>${invoice.description}</p></div>
      ` : ''}

      <!-- Amount -->
      ${isSingle ? `
      <div class="section-title">Installment Details</div>
      <div class="amount-section">
        <table class="amount-table">
          <tr><td class="label-cell">Installment Amount</td><td>${formatCurrency(inst?.amount)}</td></tr>
          ${inst?.paidAmount ? `<tr class="paid-row"><td class="label-cell">Amount Paid</td><td style="color:#059669;">- ${formatCurrency(inst?.paidAmount)}</td></tr>` : ''}
          <tr class="total-row"><td>${inst?.status === 'PAID' ? 'Total Paid' : 'Balance Due'}</td><td>${inst?.status === 'PAID' ? formatCurrency(inst?.paidAmount || inst?.amount) : formatCurrency(inst?.amount)}</td></tr>
        </table>
      </div>
      ${inst?.notes ? `<div class="section-title">Notes</div><div class="desc-block"><p>${inst.notes}</p></div>` : ''}
      ${installmentsHtml}
      ` : `
      <div class="section-title">Payment Summary</div>
      <div class="amount-section">
        <table class="amount-table">
          <tr><td class="label-cell">Total Amount</td><td>${formatCurrency(invoice.amount)}</td></tr>
          ${isInstallment ? `<tr><td class="label-cell">Installment Plan (${installments.length} payments)</td><td style="font-size:12px;color:#64748b;">${paidInstallments.length} paid, ${pendingInstallments.length} pending</td></tr>` : ''}
          ${totalPaid > 0 ? `<tr class="paid-row"><td class="label-cell">Amount Paid</td><td style="color:#059669;">- ${formatCurrency(totalPaid)}</td></tr>` : ''}
          <tr class="total-row"><td>${balance > 0 ? 'Balance Due' : 'Total Paid'}</td><td>${formatCurrency(balance > 0 ? balance : totalPaid)}</td></tr>
        </table>
      </div>
      ${installmentsHtml}
      `}
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-text">
        <strong>${appName}</strong>${clinicSubtitle ? ` &bull; ${clinicSubtitle}` : ''}<br />
        ${footerLines.join('<br />')}
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generate a PDF invoice buffer for the given invoice data and settings.
 * @param {object} invoice - Invoice data with patient, installments
 * @param {object} settings - Clinic settings (appName, clinicSubtitle, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePdfFromData(invoice, settings = {}) {
  const html = buildInvoiceHtml(invoice, settings);
  return generateInvoicePdf(html);
}

module.exports = {
  generateInvoicePdf,
  buildInvoiceHtml,
  generateInvoicePdfFromData,
};
