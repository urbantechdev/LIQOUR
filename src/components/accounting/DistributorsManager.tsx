import React, { useState } from 'react';
import { useErp } from '../../context/ErpContext';
import { CommercialDistributor, DistributorTier, DistributorPaymentTerms } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { 
  Network, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Award, 
  DollarSign, 
  X,
  Building2,
  FileText
} from 'lucide-react';

export const DistributorsManager: React.FC = () => {
  const { distributors, addDistributor, updateDistributor } = useErp();

  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<CommercialDistributor | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [code, setCode] = useState('');
  const [kraPin, setKraPin] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [county, setCounty] = useState('Nakuru');
  const [region, setRegion] = useState('Rift Valley');
  const [tier, setTier] = useState<DistributorTier>('TIER_1_SUPER_WHOLESALER');
  const [creditLimitKes, setCreditLimitKes] = useState<number>(3000000);
  const [paymentTerms, setPaymentTerms] = useState<DistributorPaymentTerms>('NET_14');

  const filteredDistributors = distributors.filter(d => {
    const matchesSearch = d.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.kraPin.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.region.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'ALL' || d.tier === tierFilter;
    return matchesSearch && matchesTier;
  });

  const totalReceivables = distributors.reduce((sum, d) => sum + d.currentReceivableKes, 0);
  const totalCreditOffered = distributors.reduce((sum, d) => sum + d.creditLimitKes, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !kraPin) return;

    try {
      await addDistributor({
        companyName,
        code: code || `MRC-${companyName.substring(0, 4).toUpperCase()}-01`,
        kraPin: kraPin.toUpperCase(),
        licenseNumber: licenseNumber || `KRA-EXCISE-LIC-2026-${Math.floor(100 + Math.random() * 900)}`,
        contactPerson,
        phone,
        email,
        county,
        region,
        tier,
        creditLimitKes: Number(creditLimitKes),
        paymentTerms,
        active: true
      });

      setIsAddModalOpen(false);
      // Reset Form
      setCompanyName('');
      setCode('');
      setKraPin('');
      setLicenseNumber('');
      setContactPerson('');
      setPhone('');
      setEmail('');
    } catch {
      // Global persistence error banner is automatically shown by ErpContext
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Top Action Bar & Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Authorized Merchants</div>
          <div className="font-montserrat font-black text-2xl text-slate-900 mt-1">
            {distributors.length} Regional Partners
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rift Valley, Coast, Mt. Kenya, Nairobi Metros
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Accounts Receivable</div>
          <div className="font-montserrat font-black text-2xl text-[#0A006E] mt-1">
            {formatKes(totalReceivables)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Tracked in General Ledger Account 1100
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Credit Line</div>
            <div className="font-montserrat font-black text-2xl text-emerald-800 mt-1">
              {formatKes(totalCreditOffered)}
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="mt-2 flex items-center justify-center space-x-2 px-3.5 py-2 bg-[#0A006E] text-white rounded-xl text-xs font-montserrat font-bold hover:bg-[#0A006E]/90 transition shadow-sm"
          >
            <Plus className="w-4 h-4 text-[#FFDE00]" />
            <span>Register Merchant</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by merchant name, PIN, region..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-montserrat font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
          >
            <option value="ALL">All Tiers</option>
            <option value="TIER_1_SUPER_WHOLESALER">Tier 1 Super Wholesaler</option>
            <option value="TIER_2_REGIONAL_DEPOT">Tier 2 Regional Depot</option>
            <option value="TIER_3_SUB_DISTRIBUTOR">Tier 3 Sub-Merchant</option>
          </select>
        </div>
      </div>

      {/* Merchants Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-montserrat font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">Merchant &amp; License</th>
                <th className="py-3 px-3">Merchant Tier</th>
                <th className="py-3 px-3">Region / County</th>
                <th className="py-3 px-3">Contact Person</th>
                <th className="py-3 px-3">Payment Terms</th>
                <th className="py-3 px-3">Credit Limit</th>
                <th className="py-3 px-3">Receivable (Due)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDistributors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-slate-500">
                    <div className="font-montserrat font-bold text-sm text-slate-800">
                      No Merchants Created Yet
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      All merchants must be created. Click <strong>Register Merchant</strong> above to create your first Wholesale Merchant.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDistributors.map((distributor) => (
                <tr key={distributor.id} className="hover:bg-slate-50 transition">
                  <td className="py-3.5 px-4">
                    <div className="font-montserrat font-bold text-slate-900 text-sm">
                      {distributor.companyName}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                      <span>Code: {distributor.code}</span>
                      <span>•</span>
                      <span>PIN: {distributor.kraPin}</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-mono">
                      Lic: {distributor.licenseNumber}
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800">
                      {distributor.tier.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700 font-medium">
                    <div>{distributor.region}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{distributor.county} County</div>
                  </td>

                  <td className="py-3.5 px-3 text-slate-700">
                    <div className="font-semibold">{distributor.contactPerson}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{distributor.phone}</div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                      {distributor.paymentTerms.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-bold text-slate-800">
                    {formatKes(distributor.creditLimitKes)}
                  </td>

                  <td className="py-3.5 px-3 font-montserrat font-black text-sm text-[#0A006E]">
                    {formatKes(distributor.currentReceivableKes)}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedDistributor(distributor)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] transition"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: REGISTER MERCHANT */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Network className="w-5 h-5 text-[#0A006E]" />
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  Register Wholesale Commercial Merchant
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
                  <label className="block text-slate-700 font-bold mb-1">Company / Depot Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rift Beverage Wholesalers Ltd"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">KRA PIN Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. P051445566E"
                    value={kraPin}
                    onChange={(e) => setKraPin(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase font-bold focus:ring-2 focus:ring-[#0A006E]"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">KRA Excise License Number</label>
                  <input
                    type="text"
                    placeholder="KRA-EXCISE-LIC-2026-901"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Merchant Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as DistributorTier)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="TIER_1_SUPER_WHOLESALER">Tier 1 Super Wholesaler</option>
                    <option value="TIER_2_REGIONAL_DEPOT">Tier 2 Regional Depot</option>
                    <option value="TIER_3_SUB_DISTRIBUTOR">Tier 3 Sub-Merchant</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Contact Person</label>
                  <input
                    type="text"
                    placeholder="e.g. David Kiprono"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+254 722 000 000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="orders@merchant.co.ke"
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
                  <label className="block text-slate-700 font-bold mb-1">Operating Region</label>
                  <input
                    type="text"
                    placeholder="e.g. Rift Valley / Nakuru"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">County Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Nakuru"
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payment Settlement Terms</label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value as DistributorPaymentTerms)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="CASH_ON_DELIVERY">Cash On Delivery (COD)</option>
                    <option value="NET_7">Net 7 Days</option>
                    <option value="NET_14">Net 14 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                  </select>
                </div>
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
                  Register Merchant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW DISTRIBUTOR DETAILS */}
      {selectedDistributor && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-montserrat font-black text-lg text-slate-900">
                  {selectedDistributor.companyName}
                </h3>
                <span className="font-mono text-xs text-slate-500 font-bold">
                  {selectedDistributor.code} • KRA PIN: {selectedDistributor.kraPin}
                </span>
              </div>
              <button 
                onClick={() => setSelectedDistributor(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Accounts Receivable (Ledger 1100):</span>
                <span className="font-montserrat font-black text-[#0A006E]">{formatKes(selectedDistributor.currentReceivableKes)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Approved Credit Limit:</span>
                <span className="font-montserrat font-bold text-slate-800">{formatKes(selectedDistributor.creditLimitKes)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between">
                <span className="text-slate-500 font-bold">Payment Settlement Terms:</span>
                <span className="font-bold text-slate-800">{selectedDistributor.paymentTerms.replace(/_/g, ' ')}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-bold mb-1">Excise License &amp; Route:</div>
                <div className="font-mono font-bold text-slate-800">{selectedDistributor.licenseNumber}</div>
                <div className="text-slate-500 mt-0.5">{selectedDistributor.region} ({selectedDistributor.county} County)</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 font-bold mb-1">Contact Details:</div>
                <div>{selectedDistributor.contactPerson} ({selectedDistributor.phone} • {selectedDistributor.email})</div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDistributor(null)}
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
