import React, { useState, useMemo } from 'react';
import { Product, StockCategory } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { ProductImage } from '../common/ProductImage';
import { Search, X, Barcode, Plus, Check } from 'lucide-react';
import { NAIROBI_DRINKS_SUB_CATEGORIES } from '../../data/nairobiDrinksCatalog';

interface CatalogLookupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  inventoryItems: any[];
  activeBranchId: string;
  onAddToCart: (product: Product, quantity?: number) => void;
  onScanBarcode: (barcode: string) => void;
}

export const CatalogLookupDrawer: React.FC<CatalogLookupDrawerProps> = ({
  isOpen,
  onClose,
  products,
  inventoryItems,
  activeBranchId,
  onAddToCart,
  onScanBarcode
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StockCategory | 'ALL'>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (selectedSubCategory !== 'ALL') {
        const sub = (p.subCategory || '').toLowerCase();
        if (sub !== selectedSubCategory.toLowerCase()) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBrand = (p.brand || '').toLowerCase().includes(q);
        const matchesBarcode = (p.barcode || '').toLowerCase().includes(q);
        const matchesSku = (p.sku || '').toLowerCase().includes(q);
        return matchesName || matchesBrand || matchesBarcode || matchesSku;
      }
      return true;
    });
  }, [products, selectedCategory, selectedSubCategory, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-montserrat font-black text-sm text-slate-900 uppercase">
                Item Lookup &amp; Drinks Catalog
              </h3>
              <p className="text-[11px] text-slate-500">
                Search or pick items to add directly to the active checkout list
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Controls */}
        <div className="p-4 border-b border-slate-100 space-y-3 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by bottle name, brand (Tusker, Hennessy), barcode or SKU..."
              autoFocus
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0A006E]"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0A006E] text-[#FFDE00]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Categories ({products.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('IPS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition shrink-0 ${
                selectedCategory === 'IPS'
                  ? 'bg-[#34D186] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              IPS (Imported)
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('LPS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-montserrat font-bold transition shrink-0 ${
                selectedCategory === 'LPS'
                  ? 'bg-[#FFDE00] text-[#0A006E]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              LPS (Local)
            </button>
          </div>

          {/* Subcategory Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
            <button
              type="button"
              onClick={() => setSelectedSubCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-montserrat font-bold transition whitespace-nowrap ${
                selectedSubCategory === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Types
            </button>
            {NAIROBI_DRINKS_SUB_CATEGORIES.map(sub => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubCategory(sub)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-montserrat font-bold transition whitespace-nowrap ${
                  selectedSubCategory.toLowerCase() === sub.toLowerCase()
                    ? 'bg-[#0A006E] text-[#FFDE00]'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        {/* Product List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Search className="w-8 h-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">No matching drinks found for &quot;{search}&quot;</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredProducts.map((p) => {
                const baseProdId = p.id.includes('-vol-') ? p.id.split('-vol-')[0] : p.id;
                const branchInv = inventoryItems.find(
                  i => i.productId === baseProdId && i.branchId === activeBranchId
                );
                const stock = branchInv ? branchInv.bottlesOnHand : 0;
                const isJustAdded = addedProductId === p.id;

                return (
                  <div
                    key={p.id}
                    className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 ${
                      isJustAdded
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-400'
                        : 'border-slate-200 bg-white hover:border-[#0A006E]/30 hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                        <ProductImage product={p} size="xs" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-montserrat font-bold text-xs text-slate-900 line-clamp-1">
                          {p.name}
                        </h4>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          {p.volumeMl} mL • SKU: {p.sku}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-montserrat font-black text-xs text-[#0A006E]">
                            {formatKes(p.retailPriceKes)}
                          </span>
                          <span className={`text-[10px] font-mono ${stock > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                            Stock: {stock}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-100">
                      {p.barcode && (
                        <button
                          type="button"
                          onClick={() => {
                            onScanBarcode(p.barcode);
                            setAddedProductId(p.id);
                            setTimeout(() => setAddedProductId(null), 1200);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-[#FFDE00] text-slate-700 hover:text-[#0A006E] text-[10px] font-mono font-bold transition flex items-center gap-1 shrink-0"
                          title="Simulate barcode scan"
                        >
                          <Barcode className="w-3 h-3" />
                          <span className="truncate max-w-20">{p.barcode}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onAddToCart(p, 1);
                          setAddedProductId(p.id);
                          setTimeout(() => setAddedProductId(null), 1200);
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-xl font-montserrat font-black text-xs transition flex items-center justify-center gap-1.5 shadow-2xs ${
                          isJustAdded
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00]'
                        }`}
                      >
                        {isJustAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Added!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to Cart</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs font-montserrat font-bold text-slate-600">
          <span>Showing {filteredProducts.length} drink(s)</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl transition"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
