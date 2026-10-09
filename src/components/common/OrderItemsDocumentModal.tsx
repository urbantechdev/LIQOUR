import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  OrderItemsDocumentPayload,
  downloadOrderItemsHtmlDocument,
  downloadOrderItemsCsvDocument,
  downloadOrderItemsTextDocument
} from '../../utils/orderItemsDocumentGenerator';
import { formatKes } from '../../utils/kenyaTax';
import {
  FileText,
  Printer,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  CheckSquare,
  Square,
  X,
  Building2,
  User,
  MapPin
} from 'lucide-react';

interface Props {
  document: OrderItemsDocumentPayload | null;
  onClose: () => void;
}

export const OrderItemsDocumentModal: React.FC<Props> = ({ document: doc, onClose }) => {
  const [checkedLines, setCheckedLines] = useState<Record<number, boolean>>({});
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  if (!doc) return null;

  const toggleLineCheck = (lineNumber: number) => {
    setCheckedLines(prev => ({
      ...prev,
      [lineNumber]: !prev[lineNumber]
    }));
  };

  const checkedCount = doc.items.filter(it => checkedLines[it.lineNumber]).length;

  const handlePrintDocument = () => {
    window.print();
  };

  const handleDownloadHtml = () => {
    downloadOrderItemsHtmlDocument(doc);
    setDownloadToast(`Downloaded official Order Items Document (Ordered-Items-Document-${doc.orderNumber}.html)`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleDownloadCsv = () => {
    downloadOrderItemsCsvDocument(doc);
    setDownloadToast(`Downloaded itemized spreadsheet (Ordered-Items-List-${doc.orderNumber}.csv)`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleDownloadTxt = () => {
    downloadOrderItemsTextDocument(doc);
    setDownloadToast(`Downloaded plain-text order list (Ordered-Items-List-${doc.orderNumber}.txt)`);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[10000] bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-none sm:rounded-3xl max-w-4xl w-full h-dvh sm:h-auto max-h-dvh sm:max-h-[92vh] overflow-hidden shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col justify-between animate-in fade-in zoom-in-95 duration-200">
        {/* Top Document Header Banner */}
        <div className="bg-[#FFDE00] text-[#0A006E] p-4 sm:p-5 flex items-center justify-between border-b-4 border-[#0A006E] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black shrink-0 shadow-sm">
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono font-bold text-[#0A006E]/80">
                <span>{doc.documentNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{doc.totalDistinctItems} Distinct Drink(s)</span>
                <span aria-hidden="true">·</span>
                <span>{doc.totalUnitsCount} Total Unit(s)</span>
              </div>
              <h3 className="font-montserrat font-black italic text-base sm:text-lg text-[#0A006E] truncate">
                Official Ordered Items List Document — {doc.orderNumber}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] transition cursor-pointer shrink-0 print:hidden"
            aria-label="Close Ordered Items Document"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Document Sheet Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 bg-slate-50/60 print:bg-white print:p-0">
          {downloadToast && (
            <div className="p-3 rounded-xl bg-[#34D186] text-white border border-[#FFDE00] text-xs font-montserrat font-bold flex items-center gap-2 print:hidden">
              <CheckCircle2 className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <span>{downloadToast}</span>
            </div>
          )}

          {/* Printable Formal Document Sheet */}
          <div className="bg-white rounded-2xl border border-slate-300 p-5 sm:p-6 space-y-5 shadow-2xs print:border-0 print:shadow-none">
            {/* Company & Document Letterhead */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b-2 border-slate-200 pb-4">
              <div>
                <h2 className="font-montserrat font-black italic text-xl sm:text-2xl text-[#0A006E] tracking-tight">
                  VAAIRO
                </h2>
                <p className="font-montserrat font-semibold text-xs text-slate-700 tracking-wide">
                  LIQUOR HUB · VAAIRO BEVERAGES &amp; MERCHANTS LTD
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Official Multi-Item Order Requisition, Packing &amp; Delivery Verification List
                </p>
              </div>

              <div className="sm:text-right font-mono text-xs space-y-0.5 text-slate-700">
                <div className="font-bold text-[#0A006E]">DOC NO: {doc.documentNumber}</div>
                <div>ORDER REF: <strong className="text-slate-900">{doc.orderNumber}</strong></div>
                <div>GENERATED: {doc.createdAt}</div>
                <div className="text-[#1E9E60] font-bold">{doc.statusLabel}</div>
              </div>
            </div>

            {/* Customer & Fulfilling Branch Metadata Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 rounded-xl border border-slate-200 p-4 text-xs">
              <div className="space-y-1.5">
                <div className="font-montserrat font-black uppercase text-[10px] text-[#0A006E] flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  <span>Customer &amp; Destination Details</span>
                </div>
                <div className="text-slate-800">
                  <span className="text-slate-500">Customer Name: </span>
                  <strong className="text-slate-900">{doc.customerName}</strong>
                </div>
                {doc.customerPhone && (
                  <div className="text-slate-800">
                    <span className="text-slate-500">Phone / M-Pesa: </span>
                    <strong className="font-mono text-[#0A006E]">{doc.customerPhone}</strong>
                  </div>
                )}
                {doc.customerEmail && (
                  <div className="text-slate-800">
                    <span className="text-slate-500">Account Email: </span>
                    <span className="font-mono">{doc.customerEmail}</span>
                  </div>
                )}
                {doc.deliveryLocation && (
                  <div className="text-slate-800 flex items-start gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0A006E] shrink-0 mt-0.5" />
                    <span>
                      <span className="text-slate-500">Location: </span>
                      <strong>{doc.deliveryLocation}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="font-montserrat font-black uppercase text-[10px] text-[#1E9E60] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Fulfilling Branch &amp; Order Summary</span>
                </div>
                <div className="text-slate-800">
                  <span className="text-slate-500">Fulfilling Branch: </span>
                  <strong className="text-slate-900">{doc.branchName}</strong>
                </div>
                <div className="text-slate-800">
                  <span className="text-slate-500">Order Channel: </span>
                  <strong>{doc.channelLabel}</strong>
                </div>
                {doc.servedByOrRider && (
                  <div className="text-slate-800">
                    <span className="text-slate-500">Handled By / Rider: </span>
                    <strong>{doc.servedByOrRider}</strong>
                  </div>
                )}
                {doc.paymentMethodLabel && (
                  <div className="text-slate-800">
                    <span className="text-slate-500">Settlement: </span>
                    <strong className="text-[#1E9E60]">{doc.paymentMethodLabel}</strong>
                  </div>
                )}
              </div>
            </div>

            {/* Complete Itemized List of Ordered Drinks */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="font-montserrat font-black text-xs uppercase tracking-wider text-slate-800">
                  Itemized List of Ordered Products ({doc.items.length} Line{doc.items.length === 1 ? '' : 's'} · {doc.totalUnitsCount} Total Units)
                </h4>
                <span className="text-[11px] font-mono text-slate-500 print:hidden">
                  Verified: {checkedCount} / {doc.items.length} line(s) checked
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#0A006E] text-white font-montserrat font-bold text-[11px] uppercase">
                      <th className="py-2.5 px-3 w-10">#</th>
                      <th className="py-2.5 px-3">Ordered Drink / Product Name</th>
                      <th className="py-2.5 px-3">SKU &amp; Barcode</th>
                      <th className="py-2.5 px-3 text-center">Ordered Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Line Total</th>
                      <th className="py-2.5 px-3 text-center w-20">Verify</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {doc.items.map(item => {
                      const isChecked = !!checkedLines[item.lineNumber];
                      return (
                        <tr
                          key={`${item.productId}-${item.lineNumber}`}
                          onClick={() => toggleLineCheck(item.lineNumber)}
                          className={`transition cursor-pointer ${
                            isChecked ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3 font-mono font-black text-[#0A006E]">
                            {String(item.lineNumber).padStart(2, '0')}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-montserrat font-bold text-slate-900">
                              {item.productName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {[item.brand, item.volumeLabel].filter(Boolean).join(' · ')}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                            <div>SKU: <strong>{item.sku}</strong></div>
                            {item.barcode && <div className="text-slate-400">EAN: {item.barcode}</div>}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="font-mono font-black text-sm text-[#1E9E60]">
                              {item.quantity}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-700 tabular-nums">
                            {formatKes(item.unitPriceKes)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-[#0A006E] tabular-nums">
                            {formatKes(item.lineTotalKes)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={e => {
                                e.stopPropagation();
                                toggleLineCheck(item.lineNumber);
                              }}
                              className="inline-flex items-center justify-center text-[#1E9E60] hover:scale-110 transition cursor-pointer"
                              aria-label={`Verify line ${item.lineNumber}`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-[#1E9E60]" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals & Sign-off Footer */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end pt-2">
              <div className="md:col-span-7 space-y-3 text-xs text-slate-600">
                {doc.notes && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-slate-800">
                    <strong className="text-[#0A006E]">Order / Delivery Notes:</strong> {doc.notes}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 pt-3 text-[11px] text-slate-500">
                  <div className="border-t border-dashed border-slate-300 pt-2">
                    <strong className="text-slate-700 block">Packed &amp; Dispatched By:</strong>
                    <span>{doc.branchName}</span>
                  </div>
                  <div className="border-t border-dashed border-slate-300 pt-2">
                    <strong className="text-slate-700 block">Customer / Receiver Confirmation:</strong>
                    <span>All {doc.totalUnitsCount} unit(s) verified</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 bg-emerald-50/70 rounded-xl border-2 border-[#34D186] p-4 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-700">
                  <span>Distinct Products Ordered:</span>
                  <strong className="font-mono">{doc.totalDistinctItems} SKU(s)</strong>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Total Quantity Ordered:</span>
                  <strong className="font-mono text-[#1E9E60]">{doc.totalUnitsCount} Bottle(s) / Unit(s)</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taxable Net (Excl. VAT):</span>
                  <span className="font-mono">{formatKes(doc.subtotalNetKes)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>16% VAT Included:</span>
                  <span className="font-mono">{formatKes(doc.vatAmountKes)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-emerald-300 font-montserrat font-black text-sm text-[#0A006E]">
                  <span>TOTAL ORDER AMOUNT:</span>
                  <span className="font-mono">{formatKes(doc.grandTotalKes)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Document Export & Print Actions */}
        <div className="p-4 sm:p-5 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintDocument}
              className="px-4 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-4 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Official Document (.HTML)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-[#0A006E] border border-slate-300 font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#1E9E60]" />
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadTxt}
              className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-montserrat font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <FileText className="w-4 h-4 text-slate-600" />
              <span>Export TXT</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-200 text-slate-700 font-montserrat font-bold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
