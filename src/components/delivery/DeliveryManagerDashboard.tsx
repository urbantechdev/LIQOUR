import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import { WebsiteDeliveryOrder, WebsiteDeliveryOrderStatus } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { EtimsReceiptModal } from '../common/EtimsReceiptModal';
import { OrderItemsDocumentModal } from '../common/OrderItemsDocumentModal';
import {
  OrderItemsDocumentPayload,
  isMultiItemOrder,
  buildOrderDocumentFromWebsiteDeliveryOrder,
  buildOrderDocumentFromSaleOrder
} from '../../utils/orderItemsDocumentGenerator';
import {
  Truck,
  MapPin,
  Phone,
  User,
  CheckCircle2,
  Clock,
  Search,
  Store,
  Plus,
  Send,
  Smartphone,
  FileText,
  Package,
  Navigation,
  ShieldCheck,
  X,
  Edit3,
  Menu
} from 'lucide-react';

export const DeliveryManagerDashboard: React.FC = () => {
  const {
    currentUser,
    currentRole,
    currentDepartment,
    activeBranch,
    branches,
    products,
    orders,
    employees,
    websiteDeliveryOrders,
    placeWebsiteDeliveryOrder,
    updateWebsiteDeliveryOrderStatus,
    assignRiderToWebsiteDeliveryOrder,
    completeWebsiteDeliveryOrderWithMpesaPrompt,
    etimsInvoices,
    lastCompletedInvoice,
    setLastCompletedInvoice
  } = useErp();

  const fleetRiders = useMemo(() => {
    const activeStaff = employees.filter(e => e.active);
    const deliveryStaff = activeStaff.filter(e => e.department === 'DELIVERY_MANAGER');
    const source = deliveryStaff.length > 0 ? deliveryStaff : activeStaff;
    return source.map(e => ({
      name: `${e.name} (${e.roleTitle})`,
      phone: e.mPesaNumber || ''
    }));
  }, [employees]);

  // Branch scoping: Delivery Manager defaults to their assigned branch; Super Admin/Accountant can switch
  const defaultBranchId =
    currentRole === 'STAFF' && currentDepartment === 'DELIVERY_MANAGER'
      ? currentUser.branchId || activeBranch.id
      : activeBranch.id;

  const [selectedBranchId, setSelectedBranchId] = useState<string>(defaultBranchId);
  const currentBranch = branches.find(b => b.id === selectedBranchId) || activeBranch;

  const [statusFilter, setStatusFilter] = useState<'ALL' | WebsiteDeliveryOrderStatus>('ALL');
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [branchOrdersChannelFilter, setBranchOrdersChannelFilter] = useState<'ALL' | 'WEBSITE' | 'POS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // Rider coordination modal state
  const [coordinatingOrder, setCoordinatingOrder] = useState<WebsiteDeliveryOrder | null>(null);
  const [activeOrderItemsDocument, setActiveOrderItemsDocument] = useState<OrderItemsDocumentPayload | null>(null);
  const [riderNameInput, setRiderNameInput] = useState('');
  const [riderPhoneInput, setRiderPhoneInput] = useState('');
  const [dispatchNotesInput, setDispatchNotesInput] = useState('');

  // M-Pesa STK completion state
  const [stkOrder, setStkOrder] = useState<WebsiteDeliveryOrder | null>(null);
  const [stkPhone, setStkPhone] = useState('');
  const [isProcessingStk, setIsProcessingStk] = useState(false);

  // New Branch Delivery Dispatch modal state
  const [isNewDispatchModalOpen, setIsNewDispatchModalOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('2547');
  const [newDeliveryLocation, setNewDeliveryLocation] = useState('');
  const [newDeliveryNotes, setNewDeliveryNotes] = useState('');
  const [newProductId, setNewProductId] = useState(products[0]?.id || '');
  const [newProductQty, setNewProductQty] = useState(1);
  const [newRiderName, setNewRiderName] = useState('');
  const [newRiderPhone, setNewRiderPhone] = useState('');

  const showToast = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // All Website Delivery Orders belonging to this branch
  const branchDeliveryOrders = useMemo(() => {
    return websiteDeliveryOrders.filter(o => o.branchId === selectedBranchId);
  }, [websiteDeliveryOrders, selectedBranchId]);

  // Filtered Delivery Orders for Coordination Board
  const filteredDeliveryOrders = useMemo(() => {
    return branchDeliveryOrders.filter(o => {
      if (statusFilter !== 'ALL' && o.deliveryStatus !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q) ||
        o.deliveryLocation.toLowerCase().includes(q) ||
        (o.riderName || '').toLowerCase().includes(q)
      );
    });
  }, [branchDeliveryOrders, statusFilter, searchQuery]);

  // All Completed/Paid POS & Website Orders made from this branch
  const branchAllOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.branchId !== selectedBranchId) return false;
      if (branchOrdersChannelFilter === 'WEBSITE' && o.orderSource !== 'WEBSITE') return false;
      if (branchOrdersChannelFilter === 'POS' && o.orderSource === 'WEBSITE') return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        (o.customerName || '').toLowerCase().includes(q) ||
        (o.cashierName || '').toLowerCase().includes(q) ||
        (o.affiliateName || '').toLowerCase().includes(q) ||
        (o.deliveryAddress || '').toLowerCase().includes(q)
      );
    });
  }, [orders, selectedBranchId, branchOrdersChannelFilter, searchQuery]);

  // KPI Metrics for this branch
  const pendingDispatchCount = branchDeliveryOrders.filter(
    o => o.deliveryStatus === 'ON_HOLD_PENDING_DELIVERY'
  ).length;
  const outForDeliveryCount = branchDeliveryOrders.filter(
    o => o.deliveryStatus === 'OUT_FOR_DELIVERY'
  ).length;
  const awaitingPaymentCount = branchDeliveryOrders.filter(
    o => o.deliveryStatus === 'DELIVERED_AWAITING_PAYMENT'
  ).length;
  const completedDeliveriesCount = branchDeliveryOrders.filter(
    o => o.deliveryStatus === 'COMPLETED_AND_PAID'
  ).length;

  const totalBranchOrdersCount =
    branchAllOrders.length +
    branchDeliveryOrders.filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID').length;

  const totalBranchOrdersValueKes =
    branchAllOrders.reduce((s, o) => s + o.totalKes, 0) +
    branchDeliveryOrders
      .filter(o => o.deliveryStatus !== 'COMPLETED_AND_PAID')
      .reduce((s, o) => s + o.totalCompanyPriceKes, 0);

  const openRiderCoordinator = (order: WebsiteDeliveryOrder) => {
    setCoordinatingOrder(order);
    setRiderNameInput(
      order.riderName && !order.riderName.startsWith('Unassigned')
        ? order.riderName
        : fleetRiders[0]?.name || ''
    );
    setRiderPhoneInput(order.riderPhone || fleetRiders[0]?.phone || '');
    setDispatchNotesInput(order.deliveryNotes || '');
  };

  const handleSaveRiderAssignment = (e: React.FormEvent, autoDispatch = false) => {
    e.preventDefault();
    if (!coordinatingOrder) return;
    assignRiderToWebsiteDeliveryOrder(
      coordinatingOrder.id,
      riderNameInput,
      riderPhoneInput,
      dispatchNotesInput
    );
    if (autoDispatch && coordinatingOrder.deliveryStatus === 'ON_HOLD_PENDING_DELIVERY') {
      updateWebsiteDeliveryOrderStatus(coordinatingOrder.id, 'OUT_FOR_DELIVERY');
    }
    showToast(
      `Coordinated Order ${coordinatingOrder.orderNumber}: Assigned rider "${riderNameInput}" (${riderPhoneInput})${
        autoDispatch ? ' and dispatched Out for Delivery.' : '.'
      }`
    );
    setCoordinatingOrder(null);
  };

  const handleCreateBranchDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === newProductId) || products[0];
    if (!prod || !newCustomerName.trim() || !newDeliveryLocation.trim()) return;

    const created = placeWebsiteDeliveryOrder({
      customerName: newCustomerName.trim(),
      customerPhone: newCustomerPhone.trim() || '254722000000',
      deliveryLocation: newDeliveryLocation.trim(),
      deliveryNotes: newDeliveryNotes.trim() || 'Coordinated by Branch Delivery Manager',
      branchId: selectedBranchId,
      items: [{ product: prod, quantity: Math.max(1, newProductQty) }]
    });

    const assignedName = newRiderName.trim() || fleetRiders[0]?.name || 'Unassigned — Awaiting Dispatch';
    const assignedPhone = newRiderPhone.trim() || fleetRiders[0]?.phone || '';
    if (assignedName && !assignedName.startsWith('Unassigned')) {
      assignRiderToWebsiteDeliveryOrder(created.id, assignedName, assignedPhone, newDeliveryNotes.trim());
    }

    showToast(
      `Created & coordinated Branch Delivery Order ${created.orderNumber} for ${created.customerName} (${assignedName}).`
    );
    setNewCustomerName('');
    setNewDeliveryLocation('');
    setNewDeliveryNotes('');
    setNewRiderName('');
    setNewRiderPhone('');
    setIsNewDispatchModalOpen(false);
  };

  const handleCompleteWithMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stkOrder) return;
    setIsProcessingStk(true);
    const res = await completeWebsiteDeliveryOrderWithMpesaPrompt(
      stkOrder.id,
      stkPhone || stkOrder.customerPhone
    );
    setIsProcessingStk(false);
    if (res.success && res.invoice) {
      setStkOrder(null);
      setLastCompletedInvoice(res.invoice);
      showToast(
        `Delivery Order ${stkOrder.orderNumber} paid via M-Pesa & reconciled to ${currentBranch.name} ledger!`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner */}
      <div className="bg-[#0A006E] text-white rounded-3xl border-2 border-[#FFDE00] p-4 sm:p-6 lg:p-8 shadow-xl flex flex-col justify-between gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-lg shrink-0">
                <Truck className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFDE00] text-[#0A006E] font-montserrat font-black text-[10px] uppercase tracking-wider">
                    Branch Delivery Manager Hub
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white border border-white/20 font-mono text-[11px] font-bold">
                    Manager: {currentUser.name}
                  </span>
                </div>
                <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl text-white tracking-tight mt-1 leading-tight">
                  {currentBranch.name} — Delivery Coordination
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Coordinate customer deliveries, assign dispatch riders, track doorstep M-Pesa completion, and monitor all orders made from your branch.
                </p>
              </div>
            </div>

            {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
            <button
              type="button"
              onClick={() => setIsHeroMenuOpen(prev => !prev)}
              aria-label="Toggle Delivery Hero Menu"
              className="sm:hidden w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
            >
              {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          {/* Branch Selector & New Delivery Dispatch Button — Collapsed Inside Hamburger on Mobile */}
          <div
            className={`${
              isHeroMenuOpen ? 'flex' : 'hidden sm:flex'
            } flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/15 animate-in fade-in`}
          >
            <div className="flex items-center gap-2 bg-white/10 border border-white/25 rounded-2xl px-3.5 py-2">
              <Store className="w-4 h-4 text-[#FFDE00] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-montserrat font-bold uppercase tracking-wider text-slate-300">
                  Assigned Branch
                </div>
                <select
                  value={selectedBranchId}
                  onChange={e => {
                    setSelectedBranchId(e.target.value);
                    setIsHeroMenuOpen(false);
                  }}
                  disabled={currentRole === 'STAFF' && currentDepartment === 'DELIVERY_MANAGER'}
                  className="bg-transparent text-xs font-montserrat font-black text-white focus:outline-none cursor-pointer disabled:cursor-default w-full"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id} className="text-slate-900 font-bold">
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsNewDispatchModalOpen(true);
                setIsHeroMenuOpen(false);
              }}
              className="px-4 py-3 rounded-2xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Dispatch New Branch Delivery</span>
            </button>
          </div>
        </div>

        {/* 4 Branch Delivery & Order Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-4 border-t border-white/15">
          <div className="p-4 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs">
            <div className="flex items-center justify-between text-xs text-slate-300 font-bold">
              <span>Orders From {currentBranch.code}</span>
              <Package className="w-4 h-4 text-[#FFDE00]" />
            </div>
            <div className="font-montserrat font-black text-2xl text-white mt-1">
              {totalBranchOrdersCount} Orders
            </div>
            <div className="text-[11px] font-mono text-[#FFDE00] font-bold mt-0.5">
              Value: {formatKes(totalBranchOrdersValueKes)}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-amber-500/20 border border-amber-300/40">
            <div className="flex items-center justify-between text-xs text-amber-200 font-bold">
              <span>Pending Rider Dispatch</span>
              <Clock className="w-4 h-4 text-[#FFDE00]" />
            </div>
            <div className="font-montserrat font-black text-2xl text-[#FFDE00] mt-1">
              {pendingDispatchCount} Waiting
            </div>
            <div className="text-[11px] text-amber-100 mt-0.5">
              Requires rider assignment &amp; dispatch
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-sky-500/20 border border-sky-300/40">
            <div className="flex items-center justify-between text-xs text-sky-200 font-bold">
              <span>In Transit &amp; Doorstep</span>
              <Navigation className="w-4 h-4 text-sky-300" />
            </div>
            <div className="font-montserrat font-black text-2xl text-white mt-1">
              {outForDeliveryCount} En Route • {awaitingPaymentCount} Arrived
            </div>
            <div className="text-[11px] text-sky-200 mt-0.5">
              Active rider deliveries in progress
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#34D186] border border-emerald-400/40">
            <div className="flex items-center justify-between text-xs text-emerald-200 font-bold">
              <span>Completed &amp; Paid Deliveries</span>
              <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
            </div>
            <div className="font-montserrat font-black text-2xl text-white mt-1">
              {completedDeliveriesCount} Delivered
            </div>
            <div className="text-[11px] text-emerald-300 font-mono mt-0.5">
              100% M-Pesa &amp; 16% VAT Verified
            </div>
          </div>
        </div>
      </div>

      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-[#1E9E60] text-xs font-montserrat font-bold flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =====================================================================
          SECTION 1: ACTIVE DELIVERY COORDINATION QUEUE (FOR THIS BRANCH)
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#0A006E]" />
              <span>Branch Delivery Coordination Queue ({filteredDeliveryOrders.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Assign riders, update live delivery milestones, and trigger doorstep M-Pesa payment prompts for orders from <strong>{currentBranch.name}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search order #, customer, rider..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:outline-none focus:border-[#0A006E]"
              />
            </div>

            {/* Status Filter Buttons */}
            {(
              [
                { id: 'ALL', label: 'All Deliveries' },
                { id: 'ON_HOLD_PENDING_DELIVERY', label: 'Pending Dispatch' },
                { id: 'OUT_FOR_DELIVERY', label: 'Out for Delivery' },
                { id: 'DELIVERED_AWAITING_PAYMENT', label: 'At Doorstep' },
                { id: 'COMPLETED_AND_PAID', label: 'Completed' }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-montserrat font-bold transition cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          {filteredDeliveryOrders.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <Truck className="w-8 h-8 text-slate-400 mx-auto" />
              <div className="font-montserrat font-bold text-sm text-slate-800">
                No delivery orders matching the current filter for {currentBranch.name}
              </div>
              <p className="text-xs text-slate-500">
                Click &ldquo;+ Dispatch New Branch Delivery&rdquo; above or place an order from the Customer Website to coordinate deliveries.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredDeliveryOrders.map(deliv => {
                const isCompleted = deliv.deliveryStatus === 'COMPLETED_AND_PAID';
                const isDoorstep = deliv.deliveryStatus === 'DELIVERED_AWAITING_PAYMENT';
                const isEnRoute = deliv.deliveryStatus === 'OUT_FOR_DELIVERY';

                return (
                  <div
                    key={deliv.id}
                    className={`rounded-2xl border-2 p-5 flex flex-col justify-between gap-4 transition ${
                      isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : isDoorstep
                        ? 'bg-amber-50/50 border-amber-300'
                        : isEnRoute
                        ? 'bg-sky-50/40 border-sky-300'
                        : 'bg-white border-slate-200 hover:border-[#0A006E]/40'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Row: Order # & Status Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-[#0A006E] text-[#FFDE00] font-mono font-black text-xs">
                            {deliv.orderNumber}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {new Date(deliv.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-montserrat font-black uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-100 text-[#1E9E60] border border-emerald-300'
                              : isDoorstep
                              ? 'bg-[#FFDE00] text-[#0A006E]'
                              : isEnRoute
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-amber-100 text-amber-900 border border-amber-300'
                          }`}
                        >
                          {deliv.deliveryStatus.replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Customer & Destination Info */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-montserrat font-black text-slate-900 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#0A006E]" />
                            <span>{deliv.customerName}</span>
                          </span>
                          <span className="font-mono font-bold text-[#0A006E] flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            <span>{deliv.customerPhone}</span>
                          </span>
                        </div>
                        <div className="flex items-start gap-1.5 text-slate-700 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                          <span>{deliv.deliveryLocation}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 pl-5 pt-0.5">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0A006E] border border-blue-200 font-montserrat font-bold text-[10px] inline-flex items-center gap-1">
                            <Navigation className="w-3 h-3" />
                            <span>Nearest Branch: {deliv.branchName}</span>
                          </span>
                          {deliv.distanceKm !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-[#1E9E60] border border-emerald-200 font-mono font-bold text-[10px]">
                              {deliv.distanceKm} km • ~{deliv.estimatedEtaMinutes || 25} mins ETA
                            </span>
                          )}
                          {deliv.routingModel && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-950 font-mono font-bold text-[9px] uppercase">
                              {deliv.routingModel.replace(/_/g, ' ')}
                            </span>
                          )}
                        </div>
                        {deliv.deliveryNotes && (
                          <div className="text-[11px] text-slate-500 italic pl-5">
                            Note: &ldquo;{deliv.deliveryNotes}&rdquo;
                          </div>
                        )}
                      </div>

                      {/* Assigned Rider Box */}
                      <div className="p-3 rounded-xl bg-[#0A006E]/5 border border-[#0A006E]/15 flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Truck className="w-4 h-4 text-[#0A006E] shrink-0" />
                          <div className="min-w-0">
                            <div className="text-[10px] font-montserrat font-bold uppercase text-slate-500">
                              Assigned Dispatch Rider
                            </div>
                            <div className="font-montserrat font-black text-slate-900 truncate">
                              {deliv.riderName || 'Unassigned — Click Coordinate Rider'}
                              {deliv.riderPhone ? ` • ${deliv.riderPhone}` : ''}
                            </div>
                          </div>
                        </div>

                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => openRiderCoordinator(deliv)}
                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-[#0A006E] border border-[#0A006E]/30 font-montserrat font-bold text-[11px] flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Assign Rider</span>
                          </button>
                        )}
                      </div>

                      {/* Order Items */}
                      <div className="space-y-1.5 pt-1">
                        {isMultiItemOrder(deliv.items) && (
                          <div className="flex items-center justify-between bg-amber-50 border border-[#0A006E]/25 rounded-lg px-2.5 py-1.5 text-[11px]">
                            <span className="font-montserrat font-bold text-[#0A006E] flex items-center gap-1">
                              <FileText className="w-3.5 h-3.5" />
                              <span>{deliv.items.reduce((s, i) => s + i.quantity, 0)} Ordered Items</span>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveOrderItemsDocument(
                                  buildOrderDocumentFromWebsiteDeliveryOrder(deliv)
                                )
                              }
                              className="px-2.5 py-1 rounded-md bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-[10px] cursor-pointer"
                            >
                              Generate Items Doc
                            </button>
                          </div>
                        )}
                        {deliv.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs text-slate-700"
                          >
                            <span className="font-medium">
                              <strong>{it.quantity}x</strong> {it.product.name}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              {formatKes(it.totalAmount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Footer: Total + Delivery Manager Action Buttons */}
                    <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-montserrat font-bold uppercase text-slate-400 block">
                          Branch Company Total
                        </span>
                        <span className="font-montserrat font-black text-base text-[#0A006E]">
                          {formatKes(deliv.totalCompanyPriceKes)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {deliv.deliveryStatus === 'ON_HOLD_PENDING_DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => {
                              updateWebsiteDeliveryOrderStatus(deliv.id, 'OUT_FOR_DELIVERY');
                              showToast(`Dispatched ${deliv.orderNumber} Out for Delivery!`);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Dispatch Rider</span>
                          </button>
                        )}

                        {deliv.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => {
                              updateWebsiteDeliveryOrderStatus(
                                deliv.id,
                                'DELIVERED_AWAITING_PAYMENT'
                              );
                              showToast(
                                `Marked ${deliv.orderNumber} Arrived at Customer Doorstep (Awaiting M-Pesa).`
                              );
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                            <span>Mark Arrived at Customer</span>
                          </button>
                        )}

                        {deliv.deliveryStatus === 'DELIVERED_AWAITING_PAYMENT' && (
                          <button
                            type="button"
                            onClick={() => {
                              setStkOrder(deliv);
                              setStkPhone(deliv.customerPhone);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Trigger M-Pesa STK Prompt</span>
                          </button>
                        )}

                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-[#1E9E60]">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>M-Pesa: {deliv.mpesaReceiptNumber || 'PAID'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          SECTION 2: ALL ORDERS MADE FROM THIS BRANCH (POS & WEBSITE LEDGER)
          ===================================================================== */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-montserrat font-black text-lg text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0A006E]" />
              <span>All Orders Made From {currentBranch.name} ({branchAllOrders.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete branch order log combining Website Delivery orders and Counter/Affiliate POS orders from this branch.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {(
              [
                { id: 'ALL', label: 'All Branch Orders' },
                { id: 'WEBSITE', label: 'Website Deliveries' },
                { id: 'POS', label: 'Branch POS Orders' }
              ] as const
            ).map(ch => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setBranchOrdersChannelFilter(ch.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold transition cursor-pointer ${
                  branchOrdersChannelFilter === ch.id
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-montserrat font-black uppercase text-slate-500">
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Date &amp; Time</th>
                <th className="py-3.5 px-4">Channel</th>
                <th className="py-3.5 px-4">Customer / Destination</th>
                <th className="py-3.5 px-4">Served By / Affiliate</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4 text-right">Amount (KES)</th>
                <th className="py-3.5 px-4 text-center">16% VAT Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {branchAllOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No completed orders recorded for {currentBranch.name} under this filter yet.
                  </td>
                </tr>
              ) : (
                branchAllOrders.map(order => {
                  const matchedInv = etimsInvoices.find(
                    inv => inv.orderId === order.id || inv.invoiceNumber === order.etimsInvoiceNumber
                  );
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-black text-[#0A006E]">
                        {order.orderNumber}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(order.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-black uppercase ${
                            order.orderSource === 'WEBSITE'
                              ? 'bg-sky-100 text-sky-900 border border-sky-300'
                              : 'bg-purple-100 text-purple-900 border border-purple-300'
                          }`}
                        >
                          {order.orderSource === 'WEBSITE' ? 'DELIVERY' : 'POS'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {order.customerName || 'Walk-in Customer'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-xs">
                          {order.deliveryAddress || order.customerPhone || currentBranch.name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {order.affiliateName || order.cashierName}
                      </td>
                      <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                        {order.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-[#1E9E60]">
                        {formatKes(order.totalKes)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isMultiItemOrder(order.items) && (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveOrderItemsDocument(
                                  buildOrderDocumentFromSaleOrder(order)
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-bold text-[11px] transition cursor-pointer"
                            >
                              Items Doc
                            </button>
                          )}
                          {matchedInv ? (
                            <button
                              type="button"
                              onClick={() => setLastCompletedInvoice(matchedInv)}
                              className="px-2.5 py-1 rounded-lg bg-[#0A006E]/10 hover:bg-[#0A006E] text-[#0A006E] hover:text-[#FFDE00] font-montserrat font-bold text-[11px] transition cursor-pointer"
                            >
                              View Receipt
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">
                              {order.etimsInvoiceNumber}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =====================================================================
          MODAL 1: ASSIGN / COORDINATE RIDER MODAL
          ===================================================================== */}
      {coordinatingOrder && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-lg w-full h-dvh sm:h-auto overflow-y-auto shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col justify-between">
            <div className="bg-[#0A006E] text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div>
                <h4 className="font-montserrat font-black text-base">
                  Coordinate Rider — {coordinatingOrder.orderNumber}
                </h4>
                <p className="text-xs text-slate-300">
                  Customer: {coordinatingOrder.customerName} ({coordinatingOrder.deliveryLocation})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCoordinatingOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={e => handleSaveRiderAssignment(e, false)} className="p-6 space-y-4">
              {fleetRiders.length > 0 && (
                <div>
                  <label className="block text-xs font-montserrat font-black uppercase text-slate-500 mb-2">
                    Select Onboarded Branch Delivery Staff / Rider
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {fleetRiders.map((r, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setRiderNameInput(r.name);
                          setRiderPhoneInput(r.phone);
                        }}
                        className={`p-3 rounded-xl border text-left text-xs flex items-center justify-between transition cursor-pointer ${
                          riderNameInput === r.name
                            ? 'bg-[#0A006E] text-white border-[#0A006E]'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                        }`}
                      >
                        <span className="font-montserrat font-bold">{r.name}</span>
                        <span className="font-mono text-[11px] opacity-80">{r.phone}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rider Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={riderNameInput}
                    onChange={e => setRiderNameInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Rider Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={riderPhoneInput}
                    onChange={e => setRiderPhoneInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Route / Coordination Notes
                </label>
                <input
                  type="text"
                  value={dispatchNotesInput}
                  onChange={e => setDispatchNotesInput(e.target.value)}
                  placeholder="Gate instructions, landmark, fragile handling..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-montserrat font-bold text-xs cursor-pointer"
                >
                  Save Rider Only
                </button>
                <button
                  type="button"
                  onClick={e => handleSaveRiderAssignment(e, true)}
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Assign &amp; Dispatch Rider Now</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 2: CREATE NEW BRANCH DELIVERY DISPATCH
          ===================================================================== */}
      {isNewDispatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-lg w-full h-dvh sm:h-auto overflow-y-auto shadow-2xl border-0 sm:border-2 border-[#0A006E] flex flex-col justify-between">
            <div className="bg-[#0A006E] text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div>
                <h4 className="font-montserrat font-black text-base">
                  New Branch Delivery Order — {currentBranch.name}
                </h4>
                <p className="text-xs text-slate-300">
                  Coordinate a direct branch delivery order at official company price
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewDispatchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBranchDispatch} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={e => setNewCustomerName(e.target.value)}
                    placeholder="e.g. Patrick Ndegwa"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Customer M-Pesa Phone *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerPhone}
                    onChange={e => setNewCustomerPhone(e.target.value)}
                    placeholder="254722000000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Estate / Building / Street *
                </label>
                <input
                  type="text"
                  required
                  value={newDeliveryLocation}
                  onChange={e => setNewDeliveryLocation(e.target.value)}
                  placeholder="e.g. Kilimani, Argwings Kodhek Rd, Apt 5B"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Drink Product *
                  </label>
                  <select
                    value={newProductId}
                    onChange={e => setNewProductId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {products.slice(0, 40).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatKes(p.retailPriceKes)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity (Bottles)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newProductQty}
                    onChange={e => setNewProductQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dispatch Rider Name
                  </label>
                  <input
                    type="text"
                    value={newRiderName}
                    onChange={e => setNewRiderName(e.target.value)}
                    placeholder={fleetRiders[0]?.name || 'Enter rider full name'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dispatch Rider Phone
                  </label>
                  <input
                    type="text"
                    value={newRiderPhone}
                    onChange={e => setNewRiderPhone(e.target.value)}
                    placeholder={fleetRiders[0]?.phone || '2547...'}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Delivery Instructions
                </label>
                <input
                  type="text"
                  value={newDeliveryNotes}
                  onChange={e => setNewDeliveryNotes(e.target.value)}
                  placeholder="Call on arrival at gate..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsNewDispatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-montserrat font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Truck className="w-4 h-4" />
                  <span>Create &amp; Coordinate Delivery</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL 3: DOORSTEP M-PESA STK PROMPT COMPLETION
          ===================================================================== */}
      {stkOrder && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-none sm:rounded-3xl max-w-md w-full h-dvh sm:h-auto overflow-y-auto shadow-2xl border-0 sm:border-2 border-[#34D186] flex flex-col justify-between">
            <div className="bg-[#34D186] text-white p-5 flex items-center justify-between border-b-2 border-[#FFDE00]">
              <div>
                <h4 className="font-montserrat font-black text-base">
                  Doorstep M-Pesa STK Prompt — {stkOrder.orderNumber}
                </h4>
                <p className="text-xs text-emerald-200">
                  Send Daraja STK push to customer upon handover
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStkOrder(null)}
                className="w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteWithMpesa} className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                <div className="text-slate-600">
                  Customer: <strong className="text-slate-900">{stkOrder.customerName}</strong>
                </div>
                <div className="text-slate-600">
                  Amount Due:{' '}
                  <strong className="font-mono text-base text-[#1E9E60]">
                    {formatKes(stkOrder.totalCompanyPriceKes)}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer Safaricom M-Pesa Number *
                </label>
                <input
                  type="text"
                  required
                  value={stkPhone}
                  onChange={e => setStkPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border-2 border-[#34D186] rounded-xl text-sm font-mono font-black"
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingStk}
                className="w-full py-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>
                  {isProcessingStk
                    ? 'Sending Safaricom STK Push...'
                    : `Send STK Prompt (${formatKes(stkOrder.totalCompanyPriceKes)}) & Complete`}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* KRA eTIMS Receipt Modal */}
      {lastCompletedInvoice && (
        <EtimsReceiptModal
          invoice={lastCompletedInvoice}
          onClose={() => setLastCompletedInvoice(null)}
        />
      )}

      {/* Official Ordered Items List Document Modal (Multi-Item Orders) */}
      {activeOrderItemsDocument && (
        <OrderItemsDocumentModal
          document={activeOrderItemsDocument}
          onClose={() => setActiveOrderItemsDocument(null)}
        />
      )}
    </div>
  );
};
