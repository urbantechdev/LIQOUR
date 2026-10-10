import React, { useState } from 'react';
import { ETimsInvoice, SaleOrder } from '../../types';
import { useErp } from '../../context/ErpContext';
import { formatKes } from '../../utils/kenyaTax';
import { generateSimpleQrSvg } from '../../utils/barcodeEngine';
import {
  buildOrderDocumentFromSaleOrder,
  downloadOrderItemsHtmlDocument,
  isMultiItemOrder
} from '../../utils/orderItemsDocumentGenerator';
import { OrderItemsDocumentModal } from './OrderItemsDocumentModal';
import { Printer, CheckCircle2, ShieldCheck, X, FileText, Download } from 'lucide-react';

interface Props {
  invoice: ETimsInvoice;
  order?: SaleOrder;
  onClose: () => void;
}

export const EtimsReceiptModal: React.FC<Props> = ({ invoice, order, onClose }) => {
  const { currentUser, orders } = useErp();
  const [showOrderItemsDoc, setShowOrderItemsDoc] = useState(false);
  const resolvedOrder = order || orders.find(o => o.id === invoice.orderId || o.etimsInvoiceNumber === invoice.invoiceNumber);
  const hasMultipleItems = resolvedOrder ? isMultiItemOrder(resolvedOrder.items) : false;
  const orderItemsDoc = resolvedOrder ? buildOrderDocumentFromSaleOrder(resolvedOrder) : null;
  const qrSvg = generateSimpleQrSvg(invoice.qrCodeUrl, 140);
  const servedByName = resolvedOrder?.cashierName || invoice.servedBy || currentUser?.name || 'Brian Omondi';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl max-w-md w-full min-h-dvh sm:min-h-0 overflow-y-auto sm:overflow-hidden border-0 sm:border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Receipt Header Banner */}
        <div className="bg-[#0A006E] text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded bg-[#FFDE00] flex items-center justify-center text-[#0A006E] font-black text-xs font-montserrat">
              VAT
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm tracking-wide">VAAIRO 16% VAT TAX INVOICE</h3>
              <p className="text-xs text-slate-300">Official 16% Value Added Tax (VAT) Compliant Receipt</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-6 font-mono text-xs space-y-4 print:p-0 bg-slate-50/50">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-3">
            <h2 className="font-montserrat font-black italic text-base text-slate-900 tracking-tight">
              VAAIRO BEVERAGES &amp; MERCHANTS LTD
            </h2>
            <p className="text-slate-600 text-[11px]">LICENSED ALCOHOL MERCHANT &amp; IMPORTER • VAAIRO POS</p>
            <p className="text-slate-600 text-[11px]">TAX PIN: <span className="font-bold text-slate-900">{invoice.sellerPin}</span></p>
            <p className="text-slate-600 text-[11px]">VAT REG REF: <span className="font-bold text-slate-900">{invoice.cuSerialNumber}</span></p>
            <p className="text-slate-600 text-[11px]">TERMINAL ID: <span className="font-bold">{invoice.deviceSerialNumber}</span></p>
          </div>

          <div className="space-y-1 text-slate-700 border-b border-dashed border-slate-300 pb-2">
            <div className="flex justify-between">
              <span>INVOICE NUMBER:</span>
              <span className="font-bold text-slate-900">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>DATE / TIME:</span>
              <span>{invoice.invoiceDate}</span>
            </div>
            <div className="flex justify-between">
              <span>CASHIER:</span>
              <span className="font-bold text-[#0A006E]">{order?.cashierName || servedByName}</span>
            </div>
            {(order?.salesPersonName || order?.affiliateName) && (
              <div className="flex justify-between">
                <span>SALES REP:</span>
                <span className="font-bold text-emerald-800">{order.salesPersonName || order.affiliateName}</span>
              </div>
            )}
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>CHECKOUT TYPE:</span>
              <span className="font-mono font-bold text-slate-800">
                {order?.checkoutRole === 'SALES_REP_SELF_CHECKOUT'
                  ? 'REP DIRECT CASHOUT'
                  : order?.checkoutRole === 'COUNTER_CASHIER_REP_RECALL'
                  ? 'COUNTER CASHIER (REP ORDER)'
                  : 'COUNTER CASHIER (DIRECT SALE)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>BUYER PIN:</span>
              <span className="font-bold">{invoice.buyerPin || 'NOT REGISTERED (CASH)'}</span>
            </div>
            <div className="flex justify-between">
              <span>BUYER NAME:</span>
              <span className="truncate max-w-[180px]">{invoice.buyerName}</span>
            </div>
            {order?.paymentMethod && (
              <div className="flex justify-between">
                <span>PAYMENT METHOD:</span>
                <span className="font-bold text-[#1E9E60]">{order.paymentMethod} {order.mpesaReceiptNumber ? `(${order.mpesaReceiptNumber})` : ''}</span>
              </div>
            )}
          </div>

          {/* Itemized Table */}
          <div className="border-b border-dashed border-slate-300 pb-3">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-1 font-semibold">ITEM DESCRIPTION</th>
                  <th className="pb-1 text-center font-semibold">QTY</th>
                  <th className="pb-1 text-right font-semibold">TOTAL (KES)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order?.items.map((item, idx) => (
                  <tr key={idx} className="text-slate-800">
                    <td className="py-1">
                      <div className="font-medium text-slate-900">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">SKU: {item.sku}</div>
                    </td>
                    <td className="py-1 text-center font-bold">{item.quantity}</td>
                    <td className="py-1 text-right font-bold">{item.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                )) || (
                  <tr>
                    <td colSpan={3} className="py-2 text-center text-slate-500">Items recorded in ledger</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Enforced 16% VAT & Financials breakdown */}
          <div className="space-y-1.5 text-slate-800 border-b border-dashed border-slate-300 pb-3">
            <div className="flex justify-between text-slate-600">
              <span>TAXABLE AMOUNT (EXCL. 16% VAT):</span>
              <span>{formatKes(invoice.taxableAmount)}</span>
            </div>
            <div className="flex justify-between text-[#1E9E60] font-bold">
              <span>ENFORCED 16% VAT COLLECTED:</span>
              <span className="font-black text-slate-900">{formatKes(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-montserrat font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>TOTAL INVOICE (INCL. 16% VAT):</span>
              <span className="text-[#0A006E]">{formatKes(invoice.totalInvoiceAmount)}</span>
            </div>
          </div>

          {/* Live Stock Subtraction & Asset Valuation Verification (Shown on Screen) */}
          {order?.items && order.items.some(it => typeof it.stockBeforeSale === 'number') && (
            <div className="p-3 rounded-lg bg-slate-900 text-white border border-[#0A006E] space-y-1.5 text-[11px] font-sans print:hidden">
              <div className="flex items-center justify-between border-b border-white/15 pb-1">
                <span className="font-montserrat font-black uppercase tracking-wider text-[#FFDE00] text-[10px]">
                  Verified Stock Subtraction Ledger
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[9px]">
                  Inventory Deducted
                </span>
              </div>
              <div className="space-y-1 font-mono text-[10px]">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-2 py-0.5 border-b border-white/5 last:border-0">
                    <span className="font-sans font-semibold text-white truncate max-w-[145px]">
                      {item.productName}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-slate-400">{item.stockBeforeSale ?? 0}</span>
                      <span className="text-red-400 font-bold">-{item.quantity}</span>
                      <span className="text-slate-400">→</span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[#FFDE00] font-black">
                        {item.stockAfterSale ?? 0} left
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {order.items.reduce((s, i) => s + (i.assetValueDeductedKes || 0), 0) > 0 && (
                <div className="flex justify-between pt-1 border-t border-white/15 text-[10px] text-slate-300">
                  <span>Asset Cost Deducted (Moved to COGS):</span>
                  <span className="font-mono font-bold text-[#FFDE00]">
                    -{formatKes(order.items.reduce((s, i) => s + (i.assetValueDeductedKes || 0), 0))}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* After-Sales Separation Audit (Shown when an Affiliate sold the order) */}
          {order?.affiliateId && (
            <div className="p-3 rounded-lg bg-emerald-50/90 border border-emerald-200 space-y-1.5 text-[11px] font-sans print:hidden">
              <div className="flex items-center justify-between border-b border-emerald-200/80 pb-1">
                <span className="font-montserrat font-black uppercase tracking-wider text-[#1E9E60] text-[10px]">
                  After-Sales Profit Separation ({order.affiliateName})
                </span>
                <span className="px-1.5 py-0.5 rounded bg-[#34D186] text-[#FFDE00] font-bold text-[9px]">
                  Company Price Protected
                </span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Customer Paid (Preferred Price):</span>
                <span className="font-mono font-bold text-slate-900">{formatKes(order.totalAmount ?? order.totalKes)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>Company Sales (Retained at Co. Price):</span>
                <span className="font-mono font-bold text-[#0A006E]">
                  {formatKes(order.companySalesTotal ?? ((order.totalAmount ?? order.totalKes) - (order.affiliateMarkupTotal || 0)))}
                </span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>Separated Affiliate Price Profit:</span>
                <span className="font-mono font-bold">
                  +{formatKes(order.affiliateProfitAmount ?? order.affiliateMarkupTotal ?? 0)}
                </span>
              </div>
              {(order.affiliateBaseCommissionAmount || 0) > 0 && (
                <div className="flex justify-between text-blue-800">
                  <span>Base Commission ({order.affiliateCommissionRate || 0}% of Co. Sales):</span>
                  <span className="font-mono font-bold">
                    +{formatKes(order.affiliateBaseCommissionAmount || 0)}
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-emerald-200 font-montserrat font-black text-[#1E9E60]">
                <span>WHAT AFFILIATE EARNS:</span>
                <span className="font-mono">{formatKes(order.affiliateCommissionAmount || 0)}</span>
              </div>
            </div>
          )}

          {/* VAT Verification QR Code & Compliance Stamp */}
          <div className="text-center pt-1 space-y-2">
            <div
              className="inline-block p-1 bg-white border border-slate-300 rounded shadow-inner"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="text-[10px] text-slate-500">
              SCAN QR CODE TO VERIFY OFFICIAL VAAIRO 16% VAT TAX INVOICE
            </p>
            <div className="bg-[#34D186]/10 text-[#1E9E60] font-bold p-1.5 rounded flex items-center justify-center space-x-1.5 text-[11px]">
              <ShieldCheck className="w-4 h-4 text-[#1E9E60]" />
              <span>VAT AUDIT CODE: {invoice.kraControlCode}</span>
            </div>
            <div className="flex items-center justify-center space-x-1 text-[10px] text-[#1E9E60]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>16% VAT Status: ENFORCED &amp; RECORDED ({invoice.transmissionStatus})</span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 space-y-2.5 print:hidden">
          {hasMultipleItems && orderItemsDoc && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-[#0A006E]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#0A006E] shrink-0" />
                <span>Multi-Item Order ({orderItemsDoc.totalUnitsCount} Items)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowOrderItemsDoc(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Generate Items Doc</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadOrderItemsHtmlDocument(orderItemsDoc)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  title="Download Official Ordered Items Document (.HTML)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-between gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-200 font-medium text-xs transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 px-4 py-2 bg-[#0A006E] text-white rounded-lg hover:bg-[#060046] font-montserrat font-bold text-xs flex items-center justify-center space-x-2 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Tax Receipt</span>
            </button>
          </div>
        </div>
      </div>

      {showOrderItemsDoc && orderItemsDoc && (
        <OrderItemsDocumentModal
          document={orderItemsDoc}
          onClose={() => setShowOrderItemsDoc(false)}
        />
      )}
    </div>
  );
};
