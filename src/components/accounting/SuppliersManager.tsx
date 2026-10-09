import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { Supplier, SupplierCategory, SupplierPaymentTerms } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Building2, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  ShieldCheck, 
  CheckCircle2, 
  X,
  Factory,
  Truck,
  ExternalLink
} from 'lucide-react';

export const SuppliersManager: React.FC = () => {
  const { suppliers, addSupplier, updateSupplier } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [category, setCategory] = useState<SupplierCategory>('LOCAL_DISTILLERY');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [physicalAddress, setPhysicalAddress] = useState('');
  const [county, setCounty] = useState('Nairobi');
  const [paymentTerms, setPaymentTerms] = useState<SupplierPaymentTerms>('NET_30');
  const [creditLimitKes, setCreditLimitKes] = useState<number>(5000000);
  const [bankName, setBankName] = useState('Standard Chartered Kenya');
  const [bankAccountNumber, setBankAccountNumber] = useState('');

  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.kraPin.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = categoryFilter === 'ALL' || s.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  const totalOutstanding = suppliers.reduce((sum, s) => sum + s.currentOutstandingKes, 0);
  const totalCreditLimit = suppliers.reduce((sum, s) => sum + s.creditLimitKes, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !kraPin) return;

    try {
      await addSupplier({
        name,
        code: code || `SUP-${name.substring(0, 4).toUpperCase()}-01`,
        kraPin: kraPin.toUpperCase(),
        category,
        contactPerson,
        email,
        phone,
        physicalAddress,
        county,
        paymentTerms,
        creditLimitKes: Number(creditLimitKes),
        bankName,
        bankAccountNumber,
        active: true
      });

      setIsAddModalOpen(false);
      // Reset Form
      setName('');
      setCode('');
      setKraPin('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      setPhysicalAddress('');
      setBankAccountNumber('');
    } catch {
      // Global persistence error banner is automatically shown by ErpContext
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Top Action Bar & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Active Suppliers</div>
          <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
            {suppliers.length} Distilleries / Importers
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Local EABL/KDL + International Bonded Importers
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Accounts Payable</div>
          <div className="font-montserrat font-black text-2xl text-red-700 mt-1">
            {formatKes(totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tracked in General Ledger Account 2010
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Credit Facility</div>
            <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
              {formatKes(totalCreditLimit)}
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-2 flex items-center justify-center space-x-2 px-3.5 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold hover:bg-[#0A006E]/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#FFDE00]" />
            <span>Add New Supplier</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by supplier name, PIN or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          >
            <option value="ALL">All Categories</option>
            <option value="LOCAL_DISTILLERY">Local Distillery (LPS)</option>
            <option value="BONDED_IMPORTER">Bonded Importer (IPS)</option>
            <option value="IMPORT_AGENT">Import Agent</option>
            <option value="PACKAGING_LOGISTICS">Packaging &amp; Logistics</option>
          </select>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Supplier &amp; KRA PIN</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Payment Terms</th>
                <th className="py-3 px-3">Credit Limit</th>
                <th className="py-3 px-3">Current Payable</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-montserrat font-bold text-slate-900 text-sm">
                      {supplier.name}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>Code: {supplier.code}</span>
                      <span>•</span>
                      <span>PIN: {supplier.kraPin}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0A006E]">
                      {supplier.category.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700">
                    <div className="font-semibold">{supplier.contactPerson}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{supplier.phone}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {supplier.paymentTerms.replace('_', ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-bold text-slate-800">
                    {formatKes(supplier.creditLimitKes)}
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-red-700">
                    {formatKes(supplier.currentOutstandingKes)}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedSupplier(supplier)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD NEW SUPPLIER */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Factory className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  Register New Distiller / Supplier
                </h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Company / Supplier Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kenya Distillers Ltd"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">KRA PIN Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. P051982341A"
                    value={kraPin}
                    onChange={(e) => setKraPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Supplier Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as SupplierCategory)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="LOCAL_DISTILLERY">Local Distillery (LPS)</option>
                    <option value="BONDED_IMPORTER">Bonded Importer (IPS)</option>
                    <option value="IMPORT_AGENT">Import Agent</option>
                    <option value="PACKAGING_LOGISTICS">Packaging &amp; Logistics</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value as SupplierPaymentTerms)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                    <option value="IMMEDIATE_CASH">Immediate Cash / RTGS</option>
                    <option value="CONSIGNMENT">Consignment Basis</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. Patrick Mutua"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+254 711 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="orders@supplier.co.ke"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Credit Limit (KES)</label>
                  <input
                    type="number"
                    value={creditLimitKes}
                    onChange={(e) => setCreditLimitKes(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Commercial Bank Name</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="0100482910001"
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Physical Address / Bonded Warehouse</label>
                <input
                  type="text"
                  placeholder="e.g. Industrial Area Off Enterprise Rd, Nairobi"
                  value={physicalAddress}
                  onChange={(e) => setPhysicalAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#0A006E] text-white font-montserrat font-bold rounded-xl hover:bg-[#0A006E]/90 transition shadow-sm"
                >
                  Save &amp; Sync Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW SUPPLIER DETAILS */}
      {selectedSupplier && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  {selectedSupplier.name}
                </h3>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  {selectedSupplier.code} • KRA PIN: {selectedSupplier.kraPin}
                </span>
              </div>
              <button 
                onClick={() => setSelectedSupplier(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Current Accounts Payable (Ledger 2010):</span>
                <span className="font-montserrat font-black text-red-700">{formatKes(selectedSupplier.currentOutstandingKes)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Agreed Credit Limit:</span>
                <span className="font-montserrat font-bold text-slate-800">{formatKes(selectedSupplier.creditLimitKes)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Settlement Terms:</span>
                <span className="font-bold text-slate-800">{selectedSupplier.paymentTerms.replace('_', ' ')}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-bold mb-1">Bank Settlement Account:</div>
                <div className="font-mono font-bold text-slate-800">{selectedSupplier.bankName} - A/C: {selectedSupplier.bankAccountNumber}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-bold mb-1">Contact &amp; Location:</div>
                <div>{selectedSupplier.contactPerson} ({selectedSupplier.phone} • {selectedSupplier.email})</div>
                <div className="text-slate-400 mt-0.5">{selectedSupplier.physicalAddress}, {selectedSupplier.county}</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedSupplier(null)}
                className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
