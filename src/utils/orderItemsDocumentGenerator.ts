import { Product, SaleOrder, WebsiteDeliveryOrder } from '../types';
import { formatKes } from './kenyaTax';

export interface OrderDocumentLineItem {
  lineNumber: number;
  productId: string;
  productName: string;
  brand?: string;
  sku: string;
  barcode?: string;
  volumeLabel?: string;
  quantity: number;
  unitPriceKes: number;
  lineTotalKes: number;
}

export interface OrderItemsDocumentPayload {
  documentNumber: string;
  orderNumber: string;
  createdAt: string;
  channelLabel: string;
  statusLabel: string;
  branchName: string;
  branchLocation?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryLocation?: string;
  servedByOrRider?: string;
  paymentMethodLabel?: string;
  notes?: string;
  items: OrderDocumentLineItem[];
  totalDistinctItems: number;
  totalUnitsCount: number;
  subtotalNetKes: number;
  vatAmountKes: number;
  grandTotalKes: number;
}

/**
 * Returns true whenever an order or cart has more than 1 item
 * (either more than 1 distinct product OR total quantity > 1 bottle/unit).
 */
export const isMultiItemOrder = (
  items: Array<{ quantity: number }> | undefined | null
): boolean => {
  if (!items || items.length === 0) return false;
  const totalUnits = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  return items.length > 1 || totalUnits > 1;
};

export const buildOrderDocumentFromWebsiteDeliveryOrder = (
  order: WebsiteDeliveryOrder
): OrderItemsDocumentPayload => {
  const items: OrderDocumentLineItem[] = order.items.map((it, idx) => ({
    lineNumber: idx + 1,
    productId: it.product.id,
    productName: it.product.name,
    brand: it.product.brand,
    sku: it.product.sku,
    barcode: it.product.barcode,
    volumeLabel: `${it.product.volumeMl || 750}ML • ${it.product.alcoholPercentage || 40}% ABV`,
    quantity: it.quantity,
    unitPriceKes: it.companyUnitPrice,
    lineTotalKes: it.totalAmount
  }));

  const totalUnitsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotalKes = order.totalCompanyPriceKes;
  const subtotalNetKes = Math.round((grandTotalKes / 1.16) * 100) / 100;
  const vatAmountKes = Math.round((grandTotalKes - subtotalNetKes) * 100) / 100;

  const statusMap: Record<WebsiteDeliveryOrder['deliveryStatus'], string> = {
    ON_HOLD_PENDING_DELIVERY: 'ON HOLD — DISPATCHED FOR DELIVERY',
    OUT_FOR_DELIVERY: 'OUT FOR DELIVERY — RIDER EN ROUTE',
    DELIVERED_AWAITING_PAYMENT: 'DELIVERED — AWAITING M-PESA PROMPT',
    COMPLETED_AND_PAID: `COMPLETED & PAID${order.mpesaReceiptNumber ? ` (${order.mpesaReceiptNumber})` : ''}`
  };

  return {
    documentNumber: `DOC-LIST-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    createdAt: new Date(order.createdAt).toLocaleString(),
    channelLabel: 'Website Direct Company Price Delivery',
    statusLabel: statusMap[order.deliveryStatus] || order.deliveryStatus,
    branchName: order.branchName,
    customerName: order.customerName || 'Online Portal Customer',
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryLocation: order.deliveryLocation,
    servedByOrRider: order.riderName || 'Branch Delivery Dispatch',
    paymentMethodLabel: order.mpesaReceiptNumber
      ? `M-Pesa Paid (${order.mpesaReceiptNumber})`
      : `M-Pesa Prompt on Delivery (${order.customerPhone})`,
    notes: order.deliveryNotes,
    items,
    totalDistinctItems: items.length,
    totalUnitsCount,
    subtotalNetKes,
    vatAmountKes,
    grandTotalKes
  };
};

export const buildOrderDocumentFromSaleOrder = (
  order: SaleOrder
): OrderItemsDocumentPayload => {
  const items: OrderDocumentLineItem[] = order.items.map((it, idx) => ({
    lineNumber: idx + 1,
    productId: it.productId,
    productName: it.productName,
    sku: it.sku,
    barcode: it.barcode,
    quantity: it.quantity,
    unitPriceKes: it.unitPrice,
    lineTotalKes: it.totalAmount
  }));

  const totalUnitsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotalKes = order.totalKes;
  const subtotalNetKes = order.subtotalKes || Math.round((grandTotalKes / 1.16) * 100) / 100;
  const vatAmountKes = order.vatAmountKes || Math.round((grandTotalKes - subtotalNetKes) * 100) / 100;

  return {
    documentNumber: `DOC-LIST-${order.orderNumber}`,
    orderNumber: order.orderNumber,
    createdAt: new Date(order.createdAt).toLocaleString(),
    channelLabel:
      order.orderSource === 'WEBSITE'
        ? 'Website Delivery Order'
        : `Branch POS (${order.saleType})`,
    statusLabel: `${order.paymentStatus} VIA ${order.paymentMethod}${
      order.mpesaReceiptNumber ? ` (${order.mpesaReceiptNumber})` : ''
    }`,
    branchName: order.branchName,
    customerName: order.customerName || 'Walk-in Customer',
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryLocation: order.deliveryAddress,
    servedByOrRider: order.affiliateName
      ? `${order.affiliateName} (Cashier: ${order.cashierName})`
      : order.cashierName,
    paymentMethodLabel: `${order.paymentMethod}${
      order.mpesaReceiptNumber ? ` • Ref: ${order.mpesaReceiptNumber}` : ''
    }`,
    items,
    totalDistinctItems: items.length,
    totalUnitsCount,
    subtotalNetKes,
    vatAmountKes,
    grandTotalKes
  };
};

export const buildOrderDocumentFromCart = (params: {
  orderNumber?: string;
  channelLabel: string;
  statusLabel?: string;
  branchName: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryLocation?: string;
  servedByOrRider?: string;
  notes?: string;
  cartItems: Array<{
    product: Product;
    quantity: number;
    unitPriceKes?: number;
  }>;
}): OrderItemsDocumentPayload => {
  const refNum = params.orderNumber || `ORD-LIST-${Date.now().toString().slice(-6)}`;
  const items: OrderDocumentLineItem[] = params.cartItems.map((it, idx) => {
    const unitPrice = it.unitPriceKes ?? it.product.retailPriceKes;
    return {
      lineNumber: idx + 1,
      productId: it.product.id,
      productName: it.product.name,
      brand: it.product.brand,
      sku: it.product.sku,
      barcode: it.product.barcode,
      volumeLabel: `${it.product.volumeMl || 750}ML • ${it.product.alcoholPercentage || 40}% ABV`,
      quantity: it.quantity,
      unitPriceKes: unitPrice,
      lineTotalKes: unitPrice * it.quantity
    };
  });

  const totalUnitsCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const grandTotalKes = items.reduce((sum, i) => sum + i.lineTotalKes, 0);
  const subtotalNetKes = Math.round((grandTotalKes / 1.16) * 100) / 100;
  const vatAmountKes = Math.round((grandTotalKes - subtotalNetKes) * 100) / 100;

  return {
    documentNumber: `DOC-${refNum}`,
    orderNumber: refNum,
    createdAt: new Date().toLocaleString(),
    channelLabel: params.channelLabel,
    statusLabel: params.statusLabel || 'ITEMIZED ORDER REQUISITION / PACKING LIST',
    branchName: params.branchName,
    customerName: params.customerName?.trim() || 'Valued Customer',
    customerPhone: params.customerPhone?.trim() || undefined,
    customerEmail: params.customerEmail?.trim() || undefined,
    deliveryLocation: params.deliveryLocation?.trim() || undefined,
    servedByOrRider: params.servedByOrRider,
    notes: params.notes?.trim() || undefined,
    items,
    totalDistinctItems: items.length,
    totalUnitsCount,
    subtotalNetKes,
    vatAmountKes,
    grandTotalKes
  };
};

const triggerBrowserDownload = (content: string, filename: string, mimeType: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

export const generateOrderItemsHtmlString = (doc: OrderItemsDocumentPayload): string => {
  const rowsHtml = doc.items
    .map(
      item => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-weight:700;color:#0A006E;">${item.lineNumber}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;">
          <div style="font-weight:700;color:#0f172a;font-size:13px;">${item.productName}</div>
          <div style="font-size:11px;color:#64748b;">${[item.brand, item.volumeLabel].filter(Boolean).join(' • ')}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:11px;color:#334155;">
          <div><strong>SKU:</strong> ${item.sku}</div>
          ${item.barcode ? `<div><strong>EAN:</strong> ${item.barcode}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;font-weight:800;font-size:14px;color:#1E9E60;">
          ${item.quantity}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-size:12px;color:#334155;">
          ${formatKes(item.unitPriceKes)}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:monospace;font-weight:800;font-size:13px;color:#0A006E;">
          ${formatKes(item.lineTotalKes)}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e2e8f0;text-align:center;font-family:monospace;font-size:14px;color:#0f172a;">
          ☐
        </td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Ordered Items Document — ${doc.orderNumber} | VAAIRO LIQUOR HUB</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
    }
    .sheet {
      max-width: 860px;
      margin: 0 auto;
      background: #ffffff;
      border: 2px solid #0A006E;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(10, 0, 110, 0.08);
    }
    .header {
      background: #0A006E;
      color: #ffffff;
      padding: 24px 28px;
      border-bottom: 4px solid #FFDE00;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      flex-wrap: wrap;
    }
    .brand-title {
      font-size: 26px;
      font-weight: 900;
      font-style: italic;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand-subtitle {
      font-size: 13px;
      font-weight: 600;
      color: #FFDE00;
      letter-spacing: 1.5px;
      margin-top: 4px;
    }
    .doc-badge {
      background: #FFDE00;
      color: #0A006E;
      font-weight: 900;
      font-size: 11px;
      padding: 6px 12px;
      border-radius: 8px;
      text-transform: uppercase;
      display: inline-block;
    }
    .content {
      padding: 24px 28px;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 24px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      padding: 16px;
      font-size: 12px;
    }
    .meta-row {
      margin-bottom: 6px;
    }
    .meta-label {
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      display: block;
    }
    .meta-value {
      color: #0f172a;
      font-weight: 700;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th {
      background: #0A006E;
      color: #ffffff;
      font-size: 11px;
      text-transform: uppercase;
      padding: 10px 8px;
      text-align: left;
    }
    .totals-box {
      margin-left: auto;
      max-width: 340px;
      background: #f0fdf4;
      border: 2px solid #34D186;
      border-radius: 12px;
      padding: 16px;
      font-size: 13px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .totals-grand {
      border-top: 2px solid #34D186;
      padding-top: 8px;
      font-weight: 900;
      font-size: 16px;
      color: #0A006E;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px dashed #94a3b8;
      font-size: 11px;
      color: #475569;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .sheet { border: none; box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <div>
        <h1 class="brand-title">VAAIRO</h1>
        <div class="brand-subtitle">LIQUOR HUB • OFFICIAL ORDERED ITEMS DOCUMENT</div>
        <div style="font-size:12px;color:#cbd5e1;margin-top:6px;">
          VAAIRO BEVERAGES &amp; MERCHANTS LTD • Multi-Item Order Packing &amp; Verification Manifest
        </div>
      </div>
      <div style="text-align:right;">
        <div class="doc-badge">${doc.documentNumber}</div>
        <div style="font-family:monospace;font-size:13px;font-weight:700;margin-top:8px;">Order Ref: ${doc.orderNumber}</div>
        <div style="font-size:11px;color:#cbd5e1;margin-top:2px;">Generated: ${doc.createdAt}</div>
      </div>
    </div>

    <div class="content">
      <div class="meta-grid">
        <div>
          <div class="meta-row">
            <span class="meta-label">Customer Details</span>
            <span class="meta-value">${doc.customerName}</span>
          </div>
          ${doc.customerPhone ? `<div class="meta-row"><span class="meta-label">Phone / M-Pesa</span><span class="meta-value">${doc.customerPhone}</span></div>` : ''}
          ${doc.customerEmail ? `<div class="meta-row"><span class="meta-label">Email Account</span><span class="meta-value">${doc.customerEmail}</span></div>` : ''}
          ${doc.deliveryLocation ? `<div class="meta-row"><span class="meta-label">Delivery Location</span><span class="meta-value">${doc.deliveryLocation}</span></div>` : ''}
        </div>
        <div>
          <div class="meta-row">
            <span class="meta-label">Fulfilling Branch</span>
            <span class="meta-value">${doc.branchName}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Order Channel &amp; Status</span>
            <span class="meta-value">${doc.channelLabel} — ${doc.statusLabel}</span>
          </div>
          ${doc.servedByOrRider ? `<div class="meta-row"><span class="meta-label">Handled By / Rider</span><span class="meta-value">${doc.servedByOrRider}</span></div>` : ''}
          ${doc.paymentMethodLabel ? `<div class="meta-row"><span class="meta-label">Payment Info</span><span class="meta-value">${doc.paymentMethodLabel}</span></div>` : ''}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>Ordered Item Description</th>
            <th>SKU / Barcode</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price</th>
            <th style="text-align:right;">Line Total</th>
            <th style="text-align:center;width:65px;">Check</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row">
          <span>Distinct Products Ordered:</span>
          <strong>${doc.totalDistinctItems} SKU(s)</strong>
        </div>
        <div class="totals-row">
          <span>Total Quantity / Bottles:</span>
          <strong>${doc.totalUnitsCount} Unit(s)</strong>
        </div>
        <div class="totals-row">
          <span>Taxable Net Amount:</span>
          <span>${formatKes(doc.subtotalNetKes)}</span>
        </div>
        <div class="totals-row">
          <span>16% VAT Included:</span>
          <span>${formatKes(doc.vatAmountKes)}</span>
        </div>
        <div class="totals-row totals-grand">
          <span>TOTAL ORDER VALUE:</span>
          <span>${formatKes(doc.grandTotalKes)}</span>
        </div>
      </div>

      ${doc.notes ? `<div style="margin-top:16px;padding:12px;background:#fefce8;border:1px solid #fde047;border-radius:8px;font-size:12px;"><strong>Order Notes:</strong> ${doc.notes}</div>` : ''}

      <div class="signatures">
        <div>
          <strong>Prepared / Packed By:</strong><br /><br />
          _______________________________<br />
          Branch Store / Warehouse Sign
        </div>
        <div>
          <strong>Dispatched / Rider Sign:</strong><br /><br />
          _______________________________<br />
          ${doc.servedByOrRider || 'Delivery / Counter Officer'}
        </div>
        <div>
          <strong>Customer Verification Sign:</strong><br /><br />
          _______________________________<br />
          All ${doc.totalUnitsCount} item(s) received intact
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
};

export const downloadOrderItemsHtmlDocument = (doc: OrderItemsDocumentPayload) => {
  const html = generateOrderItemsHtmlString(doc);
  const safeName = doc.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
  triggerBrowserDownload(html, `Ordered-Items-Document-${safeName}.html`, 'text/html;charset=utf-8');
};

export const downloadOrderItemsCsvDocument = (doc: OrderItemsDocumentPayload) => {
  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [
    ['VAAIRO LIQUOR HUB - OFFICIAL ORDERED ITEMS LIST DOCUMENT'].join(','),
    ['Document Number', escapeCsv(doc.documentNumber), 'Order Number', escapeCsv(doc.orderNumber)].join(','),
    ['Date Generated', escapeCsv(doc.createdAt), 'Fulfilling Branch', escapeCsv(doc.branchName)].join(','),
    ['Customer Name', escapeCsv(doc.customerName), 'Customer Phone', escapeCsv(doc.customerPhone || '')].join(','),
    ['Delivery Location', escapeCsv(doc.deliveryLocation || 'Branch Counter'), 'Status', escapeCsv(doc.statusLabel)].join(','),
    '',
    ['Line #', 'Product Name', 'Brand', 'SKU', 'Barcode', 'Volume / ABV', 'Quantity Ordered', 'Unit Price (KES)', 'Line Total (KES)'].join(',')
  ];

  doc.items.forEach(it => {
    lines.push(
      [
        it.lineNumber,
        escapeCsv(it.productName),
        escapeCsv(it.brand || ''),
        escapeCsv(it.sku),
        escapeCsv(it.barcode || ''),
        escapeCsv(it.volumeLabel || ''),
        it.quantity,
        it.unitPriceKes.toFixed(2),
        it.lineTotalKes.toFixed(2)
      ].join(',')
    );
  });

  lines.push('');
  lines.push(['', 'TOTAL DISTINCT PRODUCTS', doc.totalDistinctItems, '', '', 'TOTAL UNITS ORDERED', doc.totalUnitsCount, 'GRAND TOTAL (KES)', doc.grandTotalKes.toFixed(2)].join(','));

  const safeName = doc.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
  triggerBrowserDownload(lines.join('\n'), `Ordered-Items-List-${safeName}.csv`, 'text/csv;charset=utf-8');
};

export const downloadOrderItemsTextDocument = (doc: OrderItemsDocumentPayload) => {
  const divider = '========================================================================';
  const thinDivider = '------------------------------------------------------------------------';
  const lines: string[] = [
    divider,
    'VAAIRO LIQUOR HUB — OFFICIAL ORDERED ITEMS LIST DOCUMENT',
    divider,
    `Document No     : ${doc.documentNumber}`,
    `Order Reference : ${doc.orderNumber}`,
    `Date & Time     : ${doc.createdAt}`,
    `Fulfilling Store: ${doc.branchName}`,
    `Order Status    : ${doc.statusLabel}`,
    `Customer Name   : ${doc.customerName}`,
    ...(doc.customerPhone ? [`Customer Phone  : ${doc.customerPhone}`] : []),
    ...(doc.customerEmail ? [`Customer Email  : ${doc.customerEmail}`] : []),
    ...(doc.deliveryLocation ? [`Delivery Address: ${doc.deliveryLocation}`] : []),
    ...(doc.servedByOrRider ? [`Handled By      : ${doc.servedByOrRider}`] : []),
    thinDivider,
    'LIST OF ORDERED ITEMS:',
    thinDivider
  ];

  doc.items.forEach(it => {
    lines.push(
      `${String(it.lineNumber).padStart(2, '0')}. [ ] ${it.quantity}x ${it.productName} (${it.sku})`
    );
    lines.push(
      `        Unit Price: ${formatKes(it.unitPriceKes)}   |   Line Total: ${formatKes(it.lineTotalKes)}`
    );
  });

  lines.push(thinDivider);
  lines.push(`Total Distinct Products : ${doc.totalDistinctItems} SKU(s)`);
  lines.push(`Total Quantity Ordered  : ${doc.totalUnitsCount} Bottle(s) / Unit(s)`);
  lines.push(`Taxable Net Amount      : ${formatKes(doc.subtotalNetKes)}`);
  lines.push(`16% VAT Included        : ${formatKes(doc.vatAmountKes)}`);
  lines.push(`GRAND TOTAL PAYABLE     : ${formatKes(doc.grandTotalKes)}`);
  lines.push(divider);

  const safeName = doc.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '-');
  triggerBrowserDownload(lines.join('\n'), `Ordered-Items-List-${safeName}.txt`, 'text/plain;charset=utf-8');
};
