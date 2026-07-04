import { useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatCurrency = (amount) => {
  return `$${(amount || 0).toFixed(2)}`;
};

export default function InvoicePrint({ invoice, onClose, singleInstallment }) {
  const {
    appName, logoUrl, logoStyle,
    clinicSubtitle, invoiceClinicAddress, invoiceClinicPhone,
    invoiceClinicEmail, invoiceTaxId, invoiceFooter,
  } = useTheme();
  const iframeRef = useRef(null);

  // Listen for close-print message from the iframe
  useEffect(() => {
    const handler = (e) => {
      if (e.data === 'close-print') onClose();
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onClose]);

  const isInstallment = invoice?.isInstallment;
  const installments = invoice?.installments || [];
  const totalPaid = invoice?.paidAmount || 0;
  const balance = (invoice?.amount || 0) - totalPaid;
  const paidInstallments = installments.filter((i) => i.status === 'PAID');
  const pendingInstallments = installments.filter((i) => i.status === 'PENDING');
  const isSingle = !!singleInstallment;
  const inst = isSingle ? singleInstallment : null;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice #${invoice?.id} - ${appName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1a2e;
      background: #f0f2f5;
      padding: 40px 20px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .invoice-wrapper {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    /* ─── Header ─── */
    .invoice-header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      padding: 40px 48px 32px;
      color: #fff;
    }
    .invoice-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .clinic-brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .clinic-logo-img {
      height: 48px;
      width: auto;
      border-radius: 8px;
    }
    .clinic-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.15);
      border-radius: 12px;
      flex-shrink: 0;
    }
    .clinic-icon svg {
      width: 28px;
      height: 28px;
      color: #fff;
    }
    .clinic-name {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.3px;
      color: #fff;
    }
    .clinic-sub {
      font-size: 11px;
      color: rgba(255,255,255,0.6);
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .invoice-badge {
      text-align: right;
    }
    .invoice-badge h1 {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 2px;
      color: rgba(255,255,255,0.9);
    }
    .invoice-badge p {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      margin-top: 4px;
    }
    .status-badge {
      display: inline-block;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin-top: 8px;
    }
    .status-PAID { background: #059669; color: #fff; }
    .status-PARTIALLY_PAID { background: #2563eb; color: #fff; }
    .status-PENDING { background: #d97706; color: #fff; }
    .status-CANCELLED { background: #dc2626; color: #fff; }
    .status-REFUNDED { background: #7c3aed; color: #fff; }

    .invoice-meta-row {
      display: flex;
      justify-content: space-between;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.12);
    }
    .meta-item {}
    .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: rgba(255,255,255,0.4);
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: #fff;
    }

    /* ─── Body ─── */
    .invoice-body { padding: 36px 48px; }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #9ca3af;
      margin-bottom: 12px;
    }

    .patient-info {
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px 24px;
      margin-bottom: 28px;
      border: 1px solid #e2e8f0;
    }
    .patient-name {
      font-size: 17px;
      font-weight: 700;
      color: #1a1a2e;
    }
    .patient-details {
      display: flex;
      gap: 24px;
      margin-top: 8px;
      font-size: 13px;
      color: #64748b;
    }
    .patient-details span { display: flex; align-items: center; gap: 6px; }
    .patient-details .label { color: #94a3b8; font-size: 11px; }

    /* Description */
    .desc-block {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 28px;
      border: 1px solid #e2e8f0;
    }
    .desc-block p {
      font-size: 14px;
      line-height: 1.6;
      color: #334155;
    }

    /* Amount Breakdown */
    .amount-section {
      margin-bottom: 28px;
    }
    .amount-table {
      width: 100%;
      border-collapse: collapse;
    }
    .amount-table tr:last-child td {
      border-bottom: none;
    }
    .amount-table td {
      padding: 10px 0;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }
    .amount-table td:last-child {
      text-align: right;
      font-weight: 600;
    }
    .amount-table .label-cell {
      color: #64748b;
    }
    .amount-table .total-row td {
      padding-top: 14px;
      border-top: 2px solid #1a1a2e;
      border-bottom: none;
      font-size: 16px;
      font-weight: 700;
      color: #1a1a2e;
    }
    .amount-table .paid-row td {
      color: #059669;
    }
    .amount-table .balance-row td {
      color: ${balance > 0 ? '#d97706' : '#059669'};
      font-weight: 700;
      font-size: 15px;
    }
    .amount-table .balance-row td:last-child {
      font-size: 17px;
    }

    /* Installments */
    .installments-section {
      margin-bottom: 28px;
    }
    .installments-grid {
      display: grid;
      gap: 8px;
    }
    .installment-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      font-size: 13px;
    }
    .installment-item.paid {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }
    .installment-item.pending {
      background: #fffbeb;
      border-color: #fde68a;
    }
    .installment-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .installment-num {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      font-size: 12px;
      font-weight: 700;
      background: #e2e8f0;
      color: #64748b;
    }
    .installment-item.paid .installment-num {
      background: #bbf7d0;
      color: #059669;
    }
    .installment-amount {
      font-weight: 600;
      color: #1a1a2e;
    }
    .installment-date {
      color: #94a3b8;
      font-size: 12px;
    }
    .installment-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 10px;
    }
    .installment-status.paid {
      background: #bbf7d0;
      color: #059669;
    }
    .installment-status.pending {
      background: #fde68a;
      color: #92400e;
    }

    /* ─── Footer ─── */
    .invoice-footer {
      padding: 24px 48px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.8;
    }
    .footer-text strong {
      color: #64748b;
    }

    /* ─── Print Styles ─── */
      .installment-item.highlight {
      border-width: 2px;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.3);
    }
    .installment-item.highlight.paid {
      border-color: #059669;
    }
    .installment-item.highlight.pending {
      border-color: #d97706;
    }

    @media print {
      body {
        background: #fff;
        padding: 0;
      }
      .invoice-wrapper {
        box-shadow: none;
        border-radius: 0;
        max-width: 100%;
      }
      .invoice-header {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .installment-item {
        break-inside: avoid;
      }
      @page {
        margin: 12mm 10mm;
        @bottom-center {
          content: "${isSingle ? `Installment #${inst?.orderIndex} - Invoice #${invoice?.id}` : `Invoice #${invoice?.id}`} | Page " counter(page) " of " counter(pages);
          font-size: 9px;
          color: #94a3b8;
          font-family: 'Inter', sans-serif;
        }
      }
    }

    @media screen {
      .print-btn-bar {
        max-width: 800px;
        margin: 0 auto 16px;
        text-align: right;
      }
      .print-btn-bar button {
        padding: 10px 28px;
        background: #1a1a2e;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: 'Inter', sans-serif;
      }
      .print-btn-bar button:hover {
        background: #0f3460;
      }
      .print-btn-bar .close-btn {
        background: #e2e8f0;
        color: #64748b;
        margin-right: 8px;
      }
      .print-btn-bar .close-btn:hover {
        background: #cbd5e1;
      }
    }
  </style>
</head>
<body>
  <div class="print-btn-bar">
    <button class="close-btn" onclick="window.parent.postMessage('close-print','*')">Close</button>
    <button onclick="window.print()">Print / Save PDF</button>
  </div>

  <div class="invoice-wrapper">
    <!-- Header -->
    <div class="invoice-header">
      <div class="invoice-header-top">
        <div class="clinic-brand">
          ${logoUrl && logoStyle === 'image' ? `
            <img src="${logoUrl}" alt="Logo" class="clinic-logo-img" />
          ` : `
            <div class="clinic-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            </div>
          `}
          <div>
            <div class="clinic-name">${appName}</div>
            <div class="clinic-sub">${clinicSubtitle || 'Healthcare &bull; Medical Center'}</div>
          </div>
        </div>
        <div class="invoice-badge">
          <h1>${isSingle ? 'INSTALLMENT' : 'INVOICE'}</h1>
          <p>${isSingle ? `#${invoice?.id?.toString().padStart(5, '0')} / Inst. ${inst?.orderIndex}` : `#${invoice?.id?.toString().padStart(5, '0')}`}</p>
          <span class="status-badge status-${isSingle ? (inst?.status === 'PAID' ? 'PAID' : 'PENDING') : invoice?.status}">${isSingle ? (inst?.status === 'PAID' ? 'Paid' : 'Pending') : (invoice?.status || 'PENDING').replace('_', ' ')}</span>
        </div>
      </div>
      <div class="invoice-meta-row">
        ${isSingle ? `
        <div class="meta-item">
          <div class="meta-label">Installment</div>
          <div class="meta-value">${inst?.orderIndex} of ${installments.length}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Invoice</div>
          <div class="meta-value">#${invoice?.id?.toString().padStart(5, '0')}</div>
        </div>
        <div class="meta-item">
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${formatDate(inst?.dueDate)}</div>
        </div>
        ${inst?.paidAt ? `
        <div class="meta-item">
          <div class="meta-label">Paid Date</div>
          <div class="meta-value">${formatDate(inst?.paidAt)}</div>
        </div>
        ` : ''}
        ` : `
        <div class="meta-item">
          <div class="meta-label">Invoice Date</div>
          <div class="meta-value">${formatDate(invoice?.createdAt)}</div>
        </div>
        ${invoice?.dueDate ? `
        <div class="meta-item">
          <div class="meta-label">Due Date</div>
          <div class="meta-value">${formatDate(invoice?.dueDate)}</div>
        </div>
        ` : ''}
        ${invoice?.paidAt ? `
        <div class="meta-item">
          <div class="meta-label">Paid Date</div>
          <div class="meta-value">${formatDate(invoice?.paidAt)}</div>
        </div>
        ` : ''}
        ${isInstallment ? `
        <div class="meta-item">
          <div class="meta-label">Payment Plan</div>
          <div class="meta-value">${paidInstallments.length}/${installments.length} Installments Paid</div>
        </div>
        ` : `
        <div class="meta-item">
          <div class="meta-label">Payment Type</div>
          <div class="meta-value">One-time Payment</div>
        </div>
        `}
        `}
      </div>
    </div>

    <!-- Body -->
    <div class="invoice-body">
      <!-- Patient Info -->
      <div class="patient-info">
        <div class="patient-name">
          ${invoice?.patient?.firstName || ''} ${invoice?.patient?.lastName || ''}
        </div>
        <div class="patient-details">
          ${invoice?.patient?.phone ? `<span><span class="label">Phone:</span> ${invoice.patient.phone}</span>` : ''}
          ${invoice?.patient?.email ? `<span><span class="label">Email:</span> ${invoice.patient.email}</span>` : ''}
        </div>
      </div>

      ${invoiceClinicAddress || invoiceClinicPhone || invoiceClinicEmail || invoiceTaxId ? `
      <div class="section-title">Clinic Information</div>
      <div class="desc-block">
        ${invoiceClinicAddress ? `<p style="font-size:13px;margin-bottom:2px;">📍 ${invoiceClinicAddress}</p>` : ''}
        ${invoiceClinicPhone ? `<p style="font-size:13px;margin-bottom:2px;">📞 ${invoiceClinicPhone}</p>` : ''}
        ${invoiceClinicEmail ? `<p style="font-size:13px;margin-bottom:2px;">✉️ ${invoiceClinicEmail}</p>` : ''}
        ${invoiceTaxId ? `<p style="font-size:13px;margin-bottom:2px;">🏷️ Tax ID: ${invoiceTaxId}</p>` : ''}
      </div>
      ` : ''}

      <!-- Description -->
      ${invoice?.description ? `
      <div class="section-title">Service Description</div>
      <div class="desc-block">
        <p>${invoice.description}</p>
      </div>
      ` : ''}

      ${isSingle ? `
      <!-- Single Installment Amount -->
      <div class="section-title">Installment Details</div>
      <div class="amount-section">
        <table class="amount-table">
          <tr>
            <td class="label-cell">Installment Amount</td>
            <td>${formatCurrency(inst?.amount)}</td>
          </tr>
          ${inst?.paidAmount ? `
          <tr class="paid-row">
            <td class="label-cell">Amount Paid</td>
            <td style="color:#059669;">- ${formatCurrency(inst?.paidAmount)}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td>${inst?.status === 'PAID' ? 'Total Paid' : 'Balance Due'}</td>
            <td>${inst?.status === 'PAID' ? formatCurrency(inst?.paidAmount || inst?.amount) : formatCurrency(inst?.amount)}</td>
          </tr>
        </table>
      </div>

      ${inst?.notes ? `
      <div class="section-title">Notes</div>
      <div class="desc-block">
        <p>${inst.notes}</p>
      </div>
      ` : ''}

      <!-- Show all installments with this one highlighted -->
      <div class="section-title">Installment Plan Summary</div>
      <div class="installments-section">
        <div class="installments-grid">
          ${installments.map((i, idx) => `
            <div class="installment-item ${i.id === inst?.id ? (i.status === 'PAID' ? 'paid highlight' : 'pending highlight') : (i.status === 'PAID' ? 'paid' : 'pending')}">
              <div class="installment-left">
                <div class="installment-num">${idx + 1}</div>
                <div>
                  <div class="installment-amount">${formatCurrency(i.amount)}</div>
                  <div class="installment-date">Due: ${formatDate(i.dueDate)}${i.paidAt ? ` &middot; Paid: ${formatDate(i.paidAt)}` : ''}</div>
                </div>
              </div>
              <div class="installment-status ${i.status === 'PAID' ? 'paid' : 'pending'}">
                ${i.id === inst?.id ? '▼ This installment' : (i.status === 'PAID' ? 'Paid' : 'Pending')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : `
      <!-- Amount Breakdown -->
      <div class="section-title">Payment Summary</div>
      <div class="amount-section">
        <table class="amount-table">
          <tr>
            <td class="label-cell">Total Amount</td>
            <td>${formatCurrency(invoice?.amount)}</td>
          </tr>
          ${isInstallment ? `
          <tr>
            <td class="label-cell">Installment Plan (${installments.length} payments)</td>
            <td style="font-size:13px;color:#64748b;">${paidInstallments.length} paid, ${pendingInstallments.length} pending</td>
          </tr>
          ` : ''}
          ${totalPaid > 0 ? `
          <tr class="paid-row">
            <td class="label-cell">Amount Paid</td>
            <td style="color:#059669;">- ${formatCurrency(totalPaid)}</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td>${balance > 0 ? 'Balance Due' : 'Total Paid'}</td>
            <td>${formatCurrency(balance > 0 ? balance : totalPaid)}</td>
          </tr>
        </table>
      </div>

      <!-- Installments -->
      ${isInstallment && installments.length > 0 ? `
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
      </div>
      ` : ''}
      `}
    </div>

    <!-- Footer -->
    <div class="invoice-footer">
      <div class="footer-text">
        <strong>${appName}</strong>${clinicSubtitle ? ` &bull; ${clinicSubtitle}` : ''}<br />
        ${invoiceFooter ? invoiceFooter.replace(/\n/g, '<br />') : 'Thank you for choosing us for your healthcare needs.<br />This is a computer-generated invoice and does not require a physical signature.'}
      </div>
    </div>
  </div>

  <script>
    // Listen for close message from parent
    window.addEventListener('message', function(e) {
      if (e.data === 'close-print') {
        window.close();
      }
    });
  </script>
</body>
</html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden bg-white shadow-2xl">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title={`Invoice #${invoice?.id}`}
        />
      </div>
    </div>
  );
}
