import React, { useState, useMemo } from 'react';
import { useErp } from '../../context/ErpContext';
import { RestaurantFoodCategory, RestaurantFoodItem, Branch } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import { buildInitialRestaurantFoodItems } from '../../data/restaurantDefaults';
import {
  Utensils,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  Tag,
  DollarSign,
  Layers,
  ChefHat,
  X,
  AlertCircle,
  Eye,
  Store,
  Filter
} from 'lucide-react';

interface Props {
  branchId: string;
  onClose?: () => void;
}

export const RestaurantFoodManager: React.FC<Props> = ({ branchId, onClose }) => {
  const {
    branches,
    restaurantFoodCategories,
    restaurantFoodItems,
    addRestaurantFoodItem,
    updateRestaurantFoodItem,
    deleteRestaurantFoodItem,
    addRestaurantFoodCategory,
    updateRestaurantFoodCategory,
    deleteRestaurantFoodCategory
  } = useErp();

  const currentBranch = branches.find(b => b.id === branchId) || branches[0];

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'UNAVAILABLE'>('ALL');

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RestaurantFoodItem | null>(null);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RestaurantFoodCategory | null>(null);

  // Form states for Food Item
  const [itemName, setItemName] = useState('');
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [itemPriceKes, setItemPriceKes] = useState<number>(500);
  const [itemCostPriceKes, setItemCostPriceKes] = useState<number>(300);
  const [itemPortion, setItemPortion] = useState('1 Portion');
  const [itemPrepMinutes, setItemPrepMinutes] = useState<number>(20);
  const [itemDescription, setItemDescription] = useState('');
  const [itemIsAvailable, setItemIsAvailable] = useState(true);

  // Form states for Category
  const [categoryName, setCategoryName] = useState('');
  const [categoryDesc, setCategoryDesc] = useState('');

  // Items for this branch
  const branchFoodItems = useMemo(() => {
    return restaurantFoodItems.filter(i => i.branchId === branchId);
  }, [restaurantFoodItems, branchId]);

  // Filtered Items
  const filteredItems = useMemo(() => {
    return branchFoodItems.filter(item => {
      if (selectedCategoryId !== 'ALL' && item.categoryId !== selectedCategoryId) {
        return false;
      }
      if (statusFilter === 'AVAILABLE' && item.isAvailable === false) {
        return false;
      }
      if (statusFilter === 'UNAVAILABLE' && item.isAvailable !== false) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          (item.description && item.description.toLowerCase().includes(q)) ||
          (item.categoryName && item.categoryName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [branchFoodItems, selectedCategoryId, statusFilter, searchQuery]);

  const openAddItemModal = () => {
    setEditingItem(null);
    setItemName('');
    setItemCategoryId(restaurantFoodCategories[0]?.id || '');
    setItemPriceKes(600);
    setItemCostPriceKes(350);
    setItemPortion('1 Portion');
    setItemPrepMinutes(20);
    setItemDescription('');
    setItemIsAvailable(true);
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: RestaurantFoodItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategoryId(item.categoryId);
    setItemPriceKes(item.priceKes);
    setItemCostPriceKes(item.costPriceKes || Math.round(item.priceKes * 0.6));
    setItemPortion(item.servingPortion || '1 Portion');
    setItemPrepMinutes(item.preparationTimeMinutes || 20);
    setItemDescription(item.description || '');
    setItemIsAvailable(item.isAvailable !== false);
    setIsItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || itemPriceKes <= 0) return;

    const matchedCategory = restaurantFoodCategories.find(c => c.id === itemCategoryId);
    const categoryName = matchedCategory ? matchedCategory.name : 'Main Dishes';

    if (editingItem) {
      await updateRestaurantFoodItem(editingItem.id, {
        name: itemName.trim(),
        categoryId: itemCategoryId,
        categoryName,
        priceKes: Number(itemPriceKes),
        costPriceKes: Number(itemCostPriceKes),
        servingPortion: itemPortion.trim(),
        preparationTimeMinutes: Number(itemPrepMinutes),
        description: itemDescription.trim(),
        isAvailable: itemIsAvailable
      });
    } else {
      await addRestaurantFoodItem({
        branchId,
        name: itemName.trim(),
        categoryId: itemCategoryId || restaurantFoodCategories[0]?.id || 'cat-mains',
        categoryName,
        priceKes: Number(itemPriceKes),
        costPriceKes: Number(itemCostPriceKes),
        servingPortion: itemPortion.trim(),
        preparationTimeMinutes: Number(itemPrepMinutes),
        description: itemDescription.trim(),
        isAvailable: itemIsAvailable
      });
    }
    setIsItemModalOpen(false);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) return;

    if (editingCategory) {
      await updateRestaurantFoodCategory(editingCategory.id, {
        name: categoryName.trim(),
        description: categoryDesc.trim()
      });
    } else {
      await addRestaurantFoodCategory({
        name: categoryName.trim(),
        description: categoryDesc.trim(),
        displayOrder: restaurantFoodCategories.length + 1
      });
    }
    setIsCategoryModalOpen(false);
  };

  const handleSeedDefaultKenyanMenu = async () => {
    const defaultItems = buildInitialRestaurantFoodItems(branchId);
    for (const item of defaultItems) {
      // Avoid duplicate names for this branch
      if (!branchFoodItems.some(i => i.name.toLowerCase() === item.name.toLowerCase())) {
        await addRestaurantFoodItem(item);
      }
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-slate-200/90 shadow-xl overflow-hidden animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="bg-[#0A006E] text-white p-5 sm:p-6 border-b-4 border-[#FFDE00] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center font-black shadow-md shrink-0">
            <Utensils className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-montserrat font-black italic text-xl tracking-tight">
                {currentBranch?.name || 'Restaurant'} • Food Menu &amp; Pricing
              </h2>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-mono font-bold uppercase">
                Independent Branch
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Create your own customized food items, dish categories &amp; dining prices for this restaurant branch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openAddItemModal}
            className="px-3.5 py-2 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-1.5 transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Food Item</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingCategory(null);
              setCategoryName('');
              setCategoryDesc('');
              setIsCategoryModalOpen(true);
            }}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-montserrat font-bold text-xs flex items-center gap-1.5 transition border border-white/20 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Category</span>
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 sm:p-6 space-y-5">
        {/* Quick Stats & Controls Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-amber-800">
              Total Food Items
            </div>
            <div className="text-xl sm:text-2xl font-montserrat font-black text-slate-900 mt-0.5">
              {branchFoodItems.length}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-emerald-800">
              Available Items
            </div>
            <div className="text-xl sm:text-2xl font-montserrat font-black text-[#1E9E60] mt-0.5">
              {branchFoodItems.filter(i => i.isAvailable !== false).length}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
            <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-indigo-800">
              Food Categories
            </div>
            <div className="text-xl sm:text-2xl font-montserrat font-black text-[#0A006E] mt-0.5">
              {restaurantFoodCategories.length}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-200 flex flex-col justify-between">
            <div className="text-[10px] font-montserrat font-black uppercase tracking-wider text-purple-800">
              Quick Starter Menu
            </div>
            <button
              type="button"
              onClick={handleSeedDefaultKenyanMenu}
              className="text-left text-xs font-montserrat font-bold text-purple-900 hover:text-purple-950 underline mt-1 flex items-center gap-1 cursor-pointer"
              title="Populate starter Kenyan dishes (Nyama choma, fish, kuku, burgers, ugali, etc.)"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Load Starter Dishes</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search food by name, ingredient, category..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Status:</span>
            </span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-montserrat font-bold text-slate-800 bg-slate-50 focus:outline-none"
            >
              <option value="ALL">All Items</option>
              <option value="AVAILABLE">Available Only</option>
              <option value="UNAVAILABLE">Sold Out Only</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition cursor-pointer ${
              selectedCategoryId === 'ALL'
                ? 'bg-[#0A006E] text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            All Categories ({branchFoodItems.length})
          </button>
          {restaurantFoodCategories.map(cat => {
            const count = branchFoodItems.filter(i => i.categoryId === cat.id).length;
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-montserrat font-bold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0A006E] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <span>{cat.name}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  isSelected ? 'bg-[#FFDE00] text-[#0A006E] font-black' : 'bg-slate-200 text-slate-800'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Food Items Grid */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 space-y-3">
            <ChefHat className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-montserrat font-black text-slate-700 text-base">
              No Food Items Found in this Category
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your first dish or click &ldquo;Load Starter Dishes&rdquo; to populate initial Kenyan Nyama Choma, fish, kuku &amp; side items.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={openAddItemModal}
                className="px-4 py-2 rounded-xl bg-[#0A006E] text-white font-montserrat font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-[#060046] transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FFDE00]" />
                <span>Add First Food Item</span>
              </button>
              <button
                type="button"
                onClick={handleSeedDefaultKenyanMenu}
                className="px-4 py-2 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 font-montserrat font-bold text-xs transition cursor-pointer"
              >
                Load Starter Dishes
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredItems.map(item => {
              const profitMargin =
                item.costPriceKes && item.priceKes > item.costPriceKes
                  ? Math.round(((item.priceKes - item.costPriceKes) / item.priceKes) * 100)
                  : null;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all space-y-3 flex flex-col justify-between ${
                    item.isAvailable === false
                      ? 'bg-slate-50/80 border-slate-200 opacity-70'
                      : 'bg-white border-slate-200/90 shadow-2xs hover:shadow-md hover:border-[#0A006E]/30'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-montserrat font-bold text-[10px] uppercase tracking-wider">
                        {item.categoryName || 'Food'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          item.isAvailable !== false
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.isAvailable !== false ? 'Available' : 'Sold Out'}
                      </span>
                    </div>

                    <h4 className="font-montserrat font-black text-sm text-slate-900 leading-snug">
                      {item.name}
                    </h4>

                    {item.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {item.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 font-mono">
                      {item.servingPortion && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {item.servingPortion}
                        </span>
                      )}
                      {item.preparationTimeMinutes && (
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{item.preparationTimeMinutes}m</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[9px] font-montserrat font-black uppercase tracking-wider text-slate-400">
                        Selling Price
                      </div>
                      <div className="text-base font-montserrat font-black text-[#0A006E]">
                        {formatKes(item.priceKes)}
                      </div>
                      {item.costPriceKes && (
                        <div className="text-[10px] font-mono text-slate-400">
                          Cost: {formatKes(item.costPriceKes)}{' '}
                          {profitMargin && <span className="text-emerald-600 font-bold">({profitMargin}% mrg)</span>}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditItemModal(item)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-[#FFDE00] text-slate-700 hover:text-[#0A006E] transition cursor-pointer"
                        title="Edit Food Details & Price"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRestaurantFoodItem(item.id)}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition cursor-pointer"
                        title="Remove dish"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Add / Edit Food Item */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border-2 border-[#0A006E] animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center font-black">
                  <Utensils className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-montserrat font-black text-base text-slate-900">
                    {editingItem ? 'Edit Food Item & Pricing' : 'Add New Restaurant Dish'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Set dish details, portion size, and independent dining price.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsItemModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Dish / Food Name *
                </label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={e => setItemName(e.target.value)}
                  placeholder="e.g. Mbuzi Choma (1kg), Full Kuku Choma, Ugali Sukuma"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Food Category *
                  </label>
                  <select
                    value={itemCategoryId}
                    onChange={e => setItemCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
                  >
                    {restaurantFoodCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Serving Portion
                  </label>
                  <input
                    type="text"
                    value={itemPortion}
                    onChange={e => setItemPortion(e.target.value)}
                    placeholder="e.g. 1kg, 500g, 2 Chapatis, Serves 2-3"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Customer Selling Price (KES) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={itemPriceKes}
                    onChange={e => setItemPriceKes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-montserrat font-black text-sm text-[#0A006E] focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
                  />
                </div>

                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Kitchen Cost Price (KES)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={itemCostPriceKes}
                    onChange={e => setItemCostPriceKes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#0A006E]/30"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Preparation Time (Minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={itemPrepMinutes}
                    onChange={e => setItemPrepMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-montserrat font-bold text-slate-700 mb-1">
                    Menu Availability
                  </label>
                  <select
                    value={itemIsAvailable ? 'YES' : 'NO'}
                    onChange={e => setItemIsAvailable(e.target.value === 'YES')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none"
                  >
                    <option value="YES">In Stock / Available</option>
                    <option value="NO">Sold Out / Unavailable</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Description / Preparation Notes
                </label>
                <textarea
                  rows={2}
                  value={itemDescription}
                  onChange={e => setItemDescription(e.target.value)}
                  placeholder="Charcoal roasted with rosemary marinade, served with kachumbari..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-montserrat font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-white font-montserrat font-black shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#FFDE00]" />
                  <span>{editingItem ? 'Save Changes' : 'Create Food Item'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Category */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border-2 border-[#0A006E] animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-montserrat font-black text-base text-slate-900">
                Add Food Category
              </h3>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={categoryName}
                  onChange={e => setCategoryName(e.target.value)}
                  placeholder="e.g. Seafood & Fish, Breakfast Specials, Pizza & Pastas"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-montserrat font-bold text-slate-700 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={categoryDesc}
                  onChange={e => setCategoryDesc(e.target.value)}
                  placeholder="Fresh seafood caught daily..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#0A006E] text-white font-montserrat font-black"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
