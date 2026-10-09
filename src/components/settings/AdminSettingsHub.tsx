import React, { useState, useMemo, useRef } from 'react';
import { useErp } from '../../context/ErpContext';
import { StockCategory } from '../../types';
import { formatKes } from '../../utils/kenyaTax';
import {
  Settings,
  Upload,
  Download,
  Tag,
  Building2,
  Image as ImageIcon,
  Gift,
  Megaphone,
  BadgePercent,
  Sliders,
  CheckCircle2,
  Plus,
  Trash2,
  Search,
  Save,
  FileSpreadsheet,
  RefreshCw,
  Wine,
  Sparkles,
  ShieldCheck,
  Smartphone,
  Store,
  Menu,
  X
} from 'lucide-react';

type SettingsSectionTab =
  | 'PRICING_CSV_MANUAL'
  | 'BRAND_SETTINGS'
  | 'LOGO_FAVICON'
  | 'OFFERS_SETTINGS'
  | 'CAMPAIGN_SETTINGS'
  | 'PROMOTION_SETTINGS'
  | 'OTHER_SETTINGS';

interface ParsedCsvPriceRow {
  sku?: string;
  barcode?: string;
  name?: string;
  brand?: string;
  category?: StockCategory;
  volumeMl?: number;
  packSize?: number;
  warehouseCostKes?: number;
  wholesalePriceKes?: number;
  retailPriceKes?: number;
  minWholesaleQty?: number;
}

export const AdminSettingsHub: React.FC = () => {
  const {
    products,
    addProduct,
    updateProduct,
    systemSettings,
    updateSystemSettings,
    brandPriceRules,
    upsertBrandPriceRule,
    deleteBrandPriceRule,
    bulkUpdateBrandPrices,
    importPriceListFromCsvRows,
    specialOffers,
    saveSpecialOffer,
    deleteSpecialOffer,
    marketingCampaigns,
    saveMarketingCampaign,
    deleteMarketingCampaign,
    promotions,
    savePromotion,
    deletePromotion
  } = useErp();

  const [activeSubTab, setActiveSubTab] = useState<SettingsSectionTab>('PRICING_CSV_MANUAL');
  const [isHeroMenuOpen, setIsHeroMenuOpen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  // TOTP (2FA) Server Enrollment & Status State
  const [totpEnabled, setTotpEnabled] = useState<boolean>(false);
  const [totpPendingSecret, setTotpPendingSecret] = useState<string>('');
  const [totpOtpauthUrl, setTotpOtpauthUrl] = useState<string>('');
  const [totpVerifyCode, setTotpVerifyCode] = useState<string>('');
  const [totpStatusMessage, setTotpStatusMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isTotpLoading, setIsTotpLoading] = useState<boolean>(false);

  React.useEffect(() => {
    fetch('/api/auth/totp/status')
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.enabled === 'boolean') {
          setTotpEnabled(data.enabled);
        }
      })
      .catch(() => {});
  }, []);

  const handleInitTotpSetup = async () => {
    setIsTotpLoading(true);
    setTotpStatusMessage(null);
    try {
      const res = await fetch('/api/auth/totp/setup-init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountEmail: 'admin@vaairo.ke' })
      });
      const data = await res.json();
      if (data.success && data.secret) {
        setTotpPendingSecret(data.secret);
        setTotpOtpauthUrl(data.otpauthUrl || '');
        setTotpVerifyCode('');
      }
    } catch {
      setTotpStatusMessage({ ok: false, text: 'Unable to initialize TOTP setup key.' });
    } finally {
      setIsTotpLoading(false);
    }
  };

  const handleVerifyAndActivateTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = totpVerifyCode.replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      setTotpStatusMessage({ ok: false, text: 'Enter the 6-digit code from your Authenticator app.' });
      return;
    }
    setIsTotpLoading(true);
    setTotpStatusMessage(null);
    try {
      const res = await fetch('/api/auth/totp/setup-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: clean, secret: totpPendingSecret })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTotpStatusMessage({
          ok: false,
          text: data.error || 'Verification failed. Check the 6-digit code in your Authenticator app.'
        });
        return;
      }
      setTotpEnabled(true);
      setTotpPendingSecret('');
      setTotpVerifyCode('');
      setTotpStatusMessage({
        ok: true,
        text: 'TOTP (2FA) is now ACTIVE and enforced on Admin logins!'
      });
      showFeedback('TOTP (2FA) Authenticator successfully verified and activated!');
    } catch {
      setTotpStatusMessage({ ok: false, text: 'Network error while verifying TOTP code.' });
    } finally {
      setIsTotpLoading(false);
    }
  };

  const handleDisableTotp = async () => {
    setIsTotpLoading(true);
    setTotpStatusMessage(null);
    try {
      const res = await fetch('/api/auth/totp/disable', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTotpEnabled(false);
        setTotpPendingSecret('');
        setTotpStatusMessage({ ok: true, text: 'TOTP (2FA) has been disabled.' });
        showFeedback('TOTP (2FA) Authenticator disabled.');
      }
    } catch {
      setTotpStatusMessage({ ok: false, text: 'Failed to disable TOTP.' });
    } finally {
      setIsTotpLoading(false);
    }
  };

  const showFeedback = (msg: string) => {
    setFeedbackBanner(msg);
    setTimeout(() => setFeedbackBanner(null), 5000);
  };

  // ============================================================================
  // 1. BRAND PRICES & PRODUCT PRICES (CSV UPLOAD + MANUAL ENTRY) STATE
  // ============================================================================
  const [pricingMode, setPricingMode] = useState<'MANUAL_PRODUCT' | 'MANUAL_BRAND' | 'CSV_UPLOAD'>('MANUAL_PRODUCT');
  const [priceSearch, setPriceSearch] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<'ALL' | 'IPS' | 'LPS'>('ALL');

  // Inline product price edits map: productId -> { brand, warehouseCostKes, wholesalePriceKes, retailPriceKes, minWholesaleQty }
  const [inlineEdits, setInlineEdits] = useState<
    Record<
      string,
      {
        brand: string;
        warehouseCostKes: number;
        wholesalePriceKes: number;
        retailPriceKes: number;
        minWholesaleQty: number;
      }
    >
  >({});

  // Manual New Product & Price Creation Form
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProdBrand, setNewProdBrand] = useState('');
  const [newProdName, setNewProdName] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<StockCategory>('IPS');
  const [newProdVolumeMl, setNewProdVolumeMl] = useState<number>(750);
  const [newProdPackSize, setNewProdPackSize] = useState<number>(12);
  const [newProdCostKes, setNewProdCostKes] = useState<number>(1800);
  const [newProdWholesaleKes, setNewProdWholesaleKes] = useState<number>(2200);
  const [newProdRetailKes, setNewProdRetailKes] = useState<number>(2500);
  const [newProdMinWholesaleQty, setNewProdMinWholesaleQty] = useState<number>(6);

  // Manual Brand Pricing Rule Form
  const [brandRuleName, setBrandRuleName] = useState('');
  const [brandRuleCategory, setBrandRuleCategory] = useState<StockCategory>('IPS');
  const [brandRuleCountry, setBrandRuleCountry] = useState('Scotland');
  const [brandRuleVolMl, setBrandRuleVolMl] = useState<number>(750);
  const [brandRuleCostKes, setBrandRuleCostKes] = useState<number>(2000);
  const [brandRuleWholesaleKes, setBrandRuleWholesaleKes] = useState<number>(2400);
  const [brandRuleRetailKes, setBrandRuleRetailKes] = useState<number>(2800);
  const [brandRuleMinQty, setBrandRuleMinQty] = useState<number>(6);
  const [applyBrandToExisting, setApplyBrandToExisting] = useState<boolean>(true);
  const [brandPctAdjust, setBrandPctAdjust] = useState<string>('');

  // CSV Upload State
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [parsedCsvRows, setParsedCsvRows] = useState<ParsedCsvPriceRow[]>([]);
  const [rawCsvPaste, setRawCsvPaste] = useState<string>('');

  // Distinct Brands from Catalog + Brand Rules
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.brand && p.brand.trim()) set.add(p.brand.trim());
    });
    brandPriceRules.forEach(r => {
      if (r.brandName && r.brandName.trim()) set.add(r.brandName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products, brandPriceRules]);

  // Brand summary stats from live catalog
  const brandSummaries = useMemo(() => {
    return allBrands.map(brandName => {
      const brandProds = products.filter(p => p.brand.trim().toLowerCase() === brandName.toLowerCase());
      const rule = brandPriceRules.find(r => r.brandName.trim().toLowerCase() === brandName.toLowerCase());
      const avgCost =
        brandProds.length > 0
          ? Math.round(brandProds.reduce((s, p) => s + p.warehouseCostKes, 0) / brandProds.length)
          : rule?.baselineWarehouseCostKes || 0;
      const avgWholesale =
        brandProds.length > 0
          ? Math.round(brandProds.reduce((s, p) => s + p.wholesalePriceKes, 0) / brandProds.length)
          : rule?.baselineWholesalePriceKes || 0;
      const avgRetail =
        brandProds.length > 0
          ? Math.round(brandProds.reduce((s, p) => s + p.retailPriceKes, 0) / brandProds.length)
          : rule?.baselineRetailPriceKes || 0;

      return {
        brandName,
        productCount: brandProds.length,
        category: brandProds[0]?.category || rule?.category || 'IPS',
        countryOfOrigin: brandProds[0]?.countryOfOrigin || rule?.countryOfOrigin || 'Imported',
        avgCost,
        avgWholesale,
        avgRetail,
        ruleId: rule?.id
      };
    });
  }, [allBrands, products, brandPriceRules]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesBrand =
        selectedBrandFilter === 'ALL' || p.brand.trim().toLowerCase() === selectedBrandFilter.toLowerCase();
      const matchesCat = selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter;
      const q = priceSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      return matchesBrand && matchesCat && matchesSearch;
    });
  }, [products, selectedBrandFilter, selectedCategoryFilter, priceSearch]);

  // Parse CSV text into ParsedCsvPriceRow[]
  const parseCsvContent = (csvText: string): ParsedCsvPriceRow[] => {
    const lines = csvText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return [];

    const splitCsvLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headerCells = splitCsvLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const hasHeader =
      headerCells.some(h =>
        ['sku', 'barcode', 'name', 'productname', 'brand', 'retailprice', 'retailpricekes', 'wholesaleprice', 'costprice'].includes(h)
      );

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const rows: ParsedCsvPriceRow[] = [];

    dataLines.forEach(line => {
      const cols = splitCsvLine(line);
      if (cols.length < 2) return;

      if (hasHeader) {
        const rowObj: ParsedCsvPriceRow = {};
        headerCells.forEach((h, idx) => {
          const val = (cols[idx] || '').trim();
          if (!val) return;
          if (h === 'sku' || h === 'productsku') rowObj.sku = val;
          else if (h === 'barcode' || h === 'bottlebarcode' || h === 'ean') rowObj.barcode = val;
          else if (h === 'name' || h === 'productname' || h === 'product' || h === 'itemname') rowObj.name = val;
          else if (h === 'brand' || h === 'brandname') rowObj.brand = val;
          else if (h === 'category' || h === 'stockcategory') {
            rowObj.category = val.toUpperCase() === 'LPS' ? 'LPS' : 'IPS';
          } else if (h === 'volumeml' || h === 'volume' || h === 'ml') {
            rowObj.volumeMl = parseInt(val.replace(/\D/g, ''), 10) || 750;
          } else if (h === 'packsize' || h === 'casepack') {
            rowObj.packSize = parseInt(val.replace(/\D/g, ''), 10) || 12;
          } else if (h === 'warehousecostkes' || h === 'warehousecost' || h === 'costprice' || h === 'cost' || h === 'costkes') {
            rowObj.warehouseCostKes = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          } else if (h === 'wholesalepricekes' || h === 'wholesaleprice' || h === 'wholesale' || h === 'wholesalekes') {
            rowObj.wholesalePriceKes = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          } else if (h === 'retailpricekes' || h === 'retailprice' || h === 'retail' || h === 'price' || h === 'pricekes') {
            rowObj.retailPriceKes = parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
          } else if (h === 'minwholesaleqty' || h === 'minqty') {
            rowObj.minWholesaleQty = parseInt(val.replace(/\D/g, ''), 10) || 6;
          }
        });
        if (rowObj.sku || rowObj.barcode || rowObj.name || rowObj.brand) {
          rows.push(rowObj);
        }
      } else {
        // Positional fallback: SKU, Barcode, Product Name, Brand, Category, VolumeMl, WarehouseCostKes, WholesalePriceKes, RetailPriceKes
        rows.push({
          sku: cols[0] || undefined,
          barcode: cols[1] || undefined,
          name: cols[2] || undefined,
          brand: cols[3] || undefined,
          category: (cols[4] || '').toUpperCase() === 'LPS' ? 'LPS' : 'IPS',
          volumeMl: parseInt(cols[5] || '750', 10) || 750,
          warehouseCostKes: parseFloat((cols[6] || '0').replace(/[^0-9.]/g, '')) || 0,
          wholesalePriceKes: parseFloat((cols[7] || '0').replace(/[^0-9.]/g, '')) || 0,
          retailPriceKes: parseFloat((cols[8] || cols[4] || '0').replace(/[^0-9.]/g, '')) || 0
        });
      }
    });

    return rows;
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = evt => {
      const content = String(evt.target?.result || '');
      const parsed = parseCsvContent(content);
      setParsedCsvRows(parsed);
      showFeedback(`Parsed ${parsed.length} price rows from "${file.name}". Review and click Apply Price List below.`);
    };
    reader.readAsText(file);
  };

  const handleApplyParsedCsv = () => {
    if (parsedCsvRows.length === 0) return;
    const result = importPriceListFromCsvRows(parsedCsvRows);
    showFeedback(
      `CSV Price List Applied: ${result.updatedCount} existing product/brand prices updated, ${result.createdCount} new products created.`
    );
    setParsedCsvRows([]);
    setCsvFileName('');
    setRawCsvPaste('');
  };

  const handleDownloadSampleCsv = (exportFullCatalog = false) => {
    const header =
      'SKU,Barcode,ProductName,Brand,Category,VolumeMl,PackSize,WarehouseCostKes,WholesalePriceKes,RetailPriceKes,MinWholesaleQty';
    const sampleSource = exportFullCatalog ? products : products.slice(0, 15);
    const csvLines = sampleSource.map(p =>
      [
        p.sku,
        p.barcode,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.brand.replace(/"/g, '""')}"`,
        p.category,
        p.volumeMl,
        p.packSize,
        p.warehouseCostKes,
        p.wholesalePriceKes,
        p.retailPriceKes,
        p.minWholesaleQty
      ].join(',')
    );
    const csvBlob = new Blob([[header, ...csvLines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exportFullCatalog ? 'vaairo_full_price_list.csv' : 'vaairo_sample_price_list_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCreateManualProductAndPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim() || !newProdBrand.trim()) return;
    const barcode = newProdBarcode.trim() || `616${Date.now().toString().slice(-9)}`;
    const created = addProduct({
      sku:
        newProdSku.trim().toUpperCase() ||
        `${newProdCategory}-${newProdBrand.trim().slice(0, 4).toUpperCase()}-${100 + products.length}`,
      barcode,
      caseBarcode: `1${barcode}`,
      name: newProdName.trim(),
      brand: newProdBrand.trim(),
      category: newProdCategory,
      volumeMl: newProdVolumeMl || 750,
      alcoholPercentage: 40,
      packSize: newProdPackSize || 12,
      countryOfOrigin: newProdCategory === 'LPS' ? 'Kenya' : 'Imported',
      warehouseCostKes: Math.max(0, Math.round(newProdCostKes)),
      wholesalePriceKes: Math.max(0, Math.round(newProdWholesaleKes)),
      retailPriceKes: Math.max(0, Math.round(newProdRetailKes)),
      minWholesaleQty: Math.max(1, Math.round(newProdMinWholesaleQty)),
      vatRate: (systemSettings.defaultVatRatePercent || 16) / 100,
      exciseDutyPerLitreKes: systemSettings.defaultExciseDutyPerLitreKes || 356.4,
      kraExciseStampType: newProdCategory === 'IPS' ? 'IMPORT_DUTY_STAMP' : 'DIGITAL_EXCISE_STAMP'
    });
    showFeedback(
      `Added "${created.name}" (${created.brand}) — Cost: ${formatKes(created.warehouseCostKes)}, Wholesale: ${formatKes(created.wholesalePriceKes)}, Retail: ${formatKes(created.retailPriceKes)}`
    );
    setNewProdName('');
    setNewProdSku('');
    setNewProdBarcode('');
    setShowNewProductForm(false);
  };

  const handleSaveBrandPricingRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandRuleName.trim()) return;
    const rule = upsertBrandPriceRule(
      {
        brandName: brandRuleName.trim(),
        category: brandRuleCategory,
        countryOfOrigin: brandRuleCountry.trim() || 'Imported',
        defaultVolumeMl: brandRuleVolMl || 750,
        defaultPackSize: 12,
        baselineWarehouseCostKes: brandRuleCostKes,
        baselineWholesalePriceKes: brandRuleWholesaleKes,
        baselineRetailPriceKes: brandRuleRetailKes,
        minWholesaleQty: brandRuleMinQty,
        active: true
      },
      applyBrandToExisting
    );
    showFeedback(
      `Saved Brand Pricing for "${rule.brandName}" (Cost: ${formatKes(rule.baselineWarehouseCostKes)}, Wholesale: ${formatKes(rule.baselineWholesalePriceKes)}, Retail: ${formatKes(rule.baselineRetailPriceKes)})${
        applyBrandToExisting ? ' and applied to matching brand products.' : '.'
      }`
    );
    setBrandRuleName('');
  };

  // ============================================================================
  // 3. LOGO & FAVICON IMAGE FILE UPLOAD HELPERS
  // ============================================================================
  const handleImageUploadToSetting = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'faviconUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const dataUrl = String(evt.target?.result || '');
      if (dataUrl) {
        updateSystemSettings({ [field]: dataUrl });
        showFeedback(
          field === 'logoUrl'
            ? `Brand Logo updated from "${file.name}" and synced across Header & Storefront.`
            : `Browser Favicon updated from "${file.name}" and applied to the browser tab.`
        );
      }
    };
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // 4. OFFERS SETTING FORM STATE
  // ============================================================================
  const [offerTitle, setOfferTitle] = useState('');
  const [offerType, setOfferType] = useState<
    'DISCOUNT_PRICE' | 'PERCENTAGE_OFF' | 'BUY_X_GET_Y' | 'CASE_BUNDLE_DEAL' | 'HAPPY_HOUR'
  >('PERCENTAGE_OFF');
  const [offerScope, setOfferScope] = useState<'PRODUCT' | 'BRAND' | 'CATEGORY' | 'ALL_CATALOG'>('BRAND');
  const [offerBrand, setOfferBrand] = useState(allBrands[0] || 'Johnnie Walker');
  const [offerProductId, setOfferProductId] = useState(products[0]?.id || '');
  const [offerDiscountPct, setOfferDiscountPct] = useState<number>(10);
  const [offerPriceKes, setOfferPriceKes] = useState<number>(2500);
  const [offerMinQty, setOfferMinQty] = useState<number>(2);
  const [offerChannel, setOfferChannel] = useState<'ALL' | 'POS_ONLY' | 'STOREFRONT_ONLY'>('ALL');
  const [offerBadge, setOfferBadge] = useState('SPECIAL OFFER');
  const [offerEndDate, setOfferEndDate] = useState('2026-12-31');

  const handleCreateOffer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerTitle.trim()) return;
    const matchedProd = products.find(p => p.id === offerProductId);
    const created = saveSpecialOffer({
      title: offerTitle.trim(),
      offerType,
      targetScope: offerScope,
      targetBrand: offerScope === 'BRAND' ? offerBrand : undefined,
      targetProductId: offerScope === 'PRODUCT' ? offerProductId : undefined,
      targetProductName: offerScope === 'PRODUCT' ? matchedProd?.name : undefined,
      discountPercent: offerType === 'PERCENTAGE_OFF' ? offerDiscountPct : undefined,
      offerPriceKes: offerType === 'DISCOUNT_PRICE' || offerType === 'CASE_BUNDLE_DEAL' ? offerPriceKes : undefined,
      minQuantity: offerMinQty || 1,
      channel: offerChannel,
      badgeLabel: offerBadge.trim() || 'SPECIAL OFFER',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: offerEndDate,
      active: true
    });
    showFeedback(`Offer "${created.title}" created and activated.`);
    setOfferTitle('');
  };

  // ============================================================================
  // 5. CAMPAIGN SETTING FORM STATE
  // ============================================================================
  const [campName, setCampName] = useState('');
  const [campCode, setCampCode] = useState('');
  const [campHeadline, setCampHeadline] = useState('');
  const [campDesc, setCampDesc] = useState('');
  const [campChannel, setCampChannel] = useState<
    'OMNICHANNEL' | 'POS_BRANCHES' | 'ONLINE_STOREFRONT' | 'WHOLESALE_DISTRIBUTORS'
  >('OMNICHANNEL');
  const [campBrand, setCampBrand] = useState('');
  const [campBudgetKes, setCampBudgetKes] = useState<number>(150000);
  const [campTargetRevenueKes, setCampTargetRevenueKes] = useState<number>(1200000);
  const [campEndDate, setCampEndDate] = useState('2026-12-31');

  const handleCreateCampaign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!campName.trim()) return;
    const created = saveMarketingCampaign({
      name: campName.trim(),
      campaignCode: campCode.trim().toUpperCase() || `CMP-${Date.now().toString().slice(-4)}`,
      headline: campHeadline.trim() || campName.trim(),
      description: campDesc.trim() || 'Enterprise promotional campaign across branches and storefront.',
      targetChannel: campChannel,
      featuredBrand: campBrand.trim() || undefined,
      budgetKes: campBudgetKes || 0,
      targetRevenueKes: campTargetRevenueKes || 0,
      bannerColor: '#0A006E',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: campEndDate,
      active: true
    });
    showFeedback(`Campaign "${created.name}" (${created.campaignCode}) launched.`);
    setCampName('');
    setCampCode('');
    setCampHeadline('');
    setCampDesc('');
  };

  // ============================================================================
  // 6. PROMOTION SETTING FORM STATE
  // ============================================================================
  const [promoName, setPromoName] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountType, setPromoDiscountType] = useState<'PERCENTAGE' | 'FIXED_KES'>('PERCENTAGE');
  const [promoDiscountValue, setPromoDiscountValue] = useState<number>(10);
  const [promoMinOrderKes, setPromoMinOrderKes] = useState<number>(5000);
  const [promoBrand, setPromoBrand] = useState('');
  const [promoCategory, setPromoCategory] = useState<'ALL' | 'IPS' | 'LPS'>('ALL');
  const [promoAutoApplyPos, setPromoAutoApplyPos] = useState<boolean>(false);
  const [promoValidUntil, setPromoValidUntil] = useState('2026-12-31');

  const handleCreatePromotion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoName.trim() || !promoCode.trim()) return;
    const created = savePromotion({
      name: promoName.trim(),
      promoCode: promoCode.trim().toUpperCase(),
      discountType: promoDiscountType,
      discountValue: promoDiscountValue,
      minOrderAmountKes: promoMinOrderKes,
      applicableBrand: promoBrand.trim() || undefined,
      applicableCategory: promoCategory,
      autoApplyAtPos: promoAutoApplyPos,
      validUntil: promoValidUntil,
      active: true
    });
    showFeedback(`Promotion "${created.name}" (Code: ${created.promoCode}) saved.`);
    setPromoName('');
    setPromoCode('');
  };

  const SETTINGS_TABS: { id: SettingsSectionTab; label: string; sub: string; icon: React.ReactNode }[] = [
    {
      id: 'PRICING_CSV_MANUAL',
      label: 'Brand & Product Prices',
      sub: 'CSV Upload & Manual Entry',
      icon: <Tag className="w-4 h-4" />
    },
    {
      id: 'BRAND_SETTINGS',
      label: 'Brand Setting',
      sub: 'Identity & Company Profile',
      icon: <Building2 className="w-4 h-4" />
    },
    {
      id: 'LOGO_FAVICON',
      label: 'Logo & Favicon',
      sub: 'Header Logo & Browser Icon',
      icon: <ImageIcon className="w-4 h-4" />
    },
    {
      id: 'OFFERS_SETTINGS',
      label: 'Offers Setting',
      sub: `Product & Brand Deals (${specialOffers.length})`,
      icon: <Gift className="w-4 h-4" />
    },
    {
      id: 'CAMPAIGN_SETTINGS',
      label: 'Campaign Setting',
      sub: `Sales Campaigns (${marketingCampaigns.length})`,
      icon: <Megaphone className="w-4 h-4" />
    },
    {
      id: 'PROMOTION_SETTINGS',
      label: 'Promotion Setting',
      sub: `Promo Codes & Rules (${promotions.length})`,
      icon: <BadgePercent className="w-4 h-4" />
    },
    {
      id: 'OTHER_SETTINGS',
      label: 'TOTP 2FA, 16% VAT & POS Settings',
      sub: 'Authenticator TOTP, VAT & M-Pesa',
      icon: <Sliders className="w-4 h-4" />
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#0A006E] via-[#0A006E] to-[#1E9E60] rounded-3xl p-4 sm:p-6 lg:p-8 text-white shadow-xl border-b-4 border-[#FFDE00] flex flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0 shadow-lg">
              <Settings className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-montserrat font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-[#FFDE00] text-[#0A006E]">
                  Super Admin Control Center
                </span>
                <span className="text-xs font-mono text-emerald-300">
                  {products.length} Catalog Products • {allBrands.length} Brands
                </span>
              </div>
              <h2 className="font-montserrat font-black italic text-xl sm:text-2xl lg:text-3xl tracking-tight mt-1 leading-tight">
                Admin Settings, Pricing, Brand &amp; Promotions Hub
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-3xl">
                Configure Brand &amp; Product Prices (via CSV price list upload or manual entry), Enterprise Brand Settings, Logo &amp; Favicon, Special Offers, Marketing Campaigns, Promotions, and Enforced 16% VAT / POS rules.
              </p>
            </div>
          </div>

          {/* Mobile Hamburger Button to Collapse Hero Menu (< sm) */}
          <button
            type="button"
            onClick={() => setIsHeroMenuOpen(prev => !prev)}
            aria-label="Toggle Admin Settings Hero Menu"
            className="sm:hidden w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shadow-md shrink-0 cursor-pointer"
          >
            {isHeroMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Desktop Action Buttons */}
          <div className="hidden sm:flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('OTHER_SETTINGS')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-[#FFDE00] border border-[#FFDE00]/40 font-montserrat font-black text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-[#FFDE00]" />
              <span>{totpEnabled ? 'TOTP 2FA: Active' : 'Set Up TOTP (2FA)'}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDownloadSampleCsv(true)}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-montserrat font-bold text-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#FFDE00]" />
              <span>Export Price List CSV</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('PRICING_CSV_MANUAL');
                setPricingMode('CSV_UPLOAD');
              }}
              className="px-4 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Upload Price List CSV</span>
            </button>
          </div>
        </div>

        {/* Mobile Collapsed Hamburger Menu Inside Hero (< sm) */}
        {isHeroMenuOpen && (
          <div className="sm:hidden pt-3.5 border-t border-white/20 space-y-2.5 animate-in fade-in">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  handleDownloadSampleCsv(true);
                  setIsHeroMenuOpen(false);
                }}
                className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-montserrat font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#FFDE00] shrink-0" />
                <span className="truncate">Export Price CSV</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('PRICING_CSV_MANUAL');
                  setPricingMode('CSV_UPLOAD');
                  setIsHeroMenuOpen(false);
                }}
                className="px-3 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-amber-300 text-[#0A006E] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">Upload Price CSV</span>
              </button>
            </div>

            <div className="space-y-1 bg-white/10 p-2 rounded-2xl border border-white/15">
              {SETTINGS_TABS.map(tab => {
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveSubTab(tab.id);
                      setIsHeroMenuOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 rounded-xl text-left transition flex items-center gap-2.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#FFDE00] text-[#0A006E] font-black shadow-xs'
                        : 'text-white hover:bg-white/10 font-bold'
                    }`}
                  >
                    <span className="shrink-0">{tab.icon}</span>
                    <div className="min-w-0">
                      <div className="font-montserrat text-xs leading-tight truncate">{tab.label}</div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-[#0A006E]/80' : 'text-slate-300'}`}>
                        {tab.sub}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {feedbackBanner && (
        <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-400 text-[#1E9E60] text-xs sm:text-sm font-montserrat font-bold flex items-center justify-between gap-3 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-emerald-800 hover:text-emerald-950 font-black px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs (Desktop Only — Collapsed Inside Hero Hamburger on Mobile) */}
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
        {SETTINGS_TABS.map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id)}
              className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#0A006E] text-white border-[#0A006E] shadow-md ring-2 ring-[#FFDE00]'
                  : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isActive ? 'bg-[#FFDE00] text-[#0A006E]' : 'bg-slate-100 text-[#0A006E]'
                  }`}
                >
                  {tab.icon}
                </span>
              </div>
              <div>
                <div className="font-montserrat font-black text-xs leading-tight">{tab.label}</div>
                <div className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-[#FFDE00]' : 'text-slate-500'}`}>
                  {tab.sub}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: BRAND PRICES & PRODUCT PRICES (CSV UPLOAD OR MANUAL ENTRY)
      ===================================================================== */}
      {activeSubTab === 'PRICING_CSV_MANUAL' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
                Brand Prices &amp; Product Prices Configuration
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Set Warehouse Cost, Wholesale Price, and Retail Price per Product or per Brand — either by <strong>Manual Entry</strong> or by <strong>Uploading a CSV Price List</strong>.
              </p>
            </div>

            {/* 3 Mode Switcher Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setPricingMode('MANUAL_PRODUCT')}
                className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-black transition cursor-pointer ${
                  pricingMode === 'MANUAL_PRODUCT'
                    ? 'bg-[#0A006E] text-[#FFDE00] shadow-xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                1. Manual Product Prices ({products.length})
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('MANUAL_BRAND')}
                className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-black transition cursor-pointer ${
                  pricingMode === 'MANUAL_BRAND'
                    ? 'bg-[#34D186] text-[#FFDE00] shadow-xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                2. Manual Brand Prices ({allBrands.length})
              </button>
              <button
                type="button"
                onClick={() => setPricingMode('CSV_UPLOAD')}
                className={`px-3.5 py-2 rounded-xl text-xs font-montserrat font-black transition flex items-center gap-1.5 cursor-pointer ${
                  pricingMode === 'CSV_UPLOAD'
                    ? 'bg-[#FFDE00] text-[#0A006E] border border-[#0A006E]/30 shadow-xs'
                    : 'text-slate-700 hover:text-slate-950'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>3. Upload CSV Price List</span>
              </button>
            </div>
          </div>

          {/* MODE A: CSV PRICE LIST UPLOAD */}
          {pricingMode === 'CSV_UPLOAD' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 p-6 rounded-2xl bg-slate-50 border-2 border-dashed border-[#0A006E]/40 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#0A006E] text-[#FFDE00] flex items-center justify-center shadow-md">
                    <Upload className="w-7 h-7" />
                  </div>
                  <div className="space-y-1 max-w-lg">
                    <h4 className="font-montserrat font-black text-base text-slate-900">
                      Upload Brand &amp; Product Price List (.CSV)
                    </h4>
                    <p className="text-xs text-slate-600">
                      Upload a CSV spreadsheet with columns: <code className="font-mono bg-white px-1.5 py-0.5 rounded border">SKU, Barcode, ProductName, Brand, Category, VolumeMl, WarehouseCostKes, WholesalePriceKes, RetailPriceKes</code>.
                    </p>
                  </div>

                  <input
                    ref={csvFileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />

                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => csvFileInputRef.current?.click()}
                      className="px-5 py-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Select CSV File from Computer</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadSampleCsv(false)}
                      className="px-4 py-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-montserrat font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-[#1E9E60]" />
                      <span>Download Sample CSV Template</span>
                    </button>
                  </div>

                  {csvFileName && (
                    <div className="text-xs font-mono font-bold text-[#1E9E60] bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                      Loaded File: {csvFileName} ({parsedCsvRows.length} rows ready)
                    </div>
                  )}
                </div>

                {/* Or Paste CSV Directly */}
                <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-montserrat font-black text-slate-800 uppercase">
                      Or Paste CSV Rows Directly
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const sample = `SKU,Barcode,ProductName,Brand,Category,VolumeMl,WarehouseCostKes,WholesalePriceKes,RetailPriceKes\nIPS-WHISKY-002,500029912302,Johnnie Walker Black Label 12Yr (750ml),Johnnie Walker,IPS,750,3100,3550,3900\nLPS-BEER-001,616110120101,Tusker Lager Bottle (500ml),Tusker,LPS,500,170,210,250`;
                        setRawCsvPaste(sample);
                        setParsedCsvRows(parseCsvContent(sample));
                      }}
                      className="text-[11px] font-montserrat font-bold text-[#0A006E] hover:underline"
                    >
                      Load Sample Rows
                    </button>
                  </div>
                  <textarea
                    rows={5}
                    value={rawCsvPaste}
                    onChange={e => {
                      setRawCsvPaste(e.target.value);
                      setParsedCsvRows(parseCsvContent(e.target.value));
                    }}
                    placeholder="SKU,Barcode,ProductName,Brand,Category,VolumeMl,WarehouseCostKes,WholesalePriceKes,RetailPriceKes..."
                    className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-[#0A006E]"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tip: Matching SKUs, Barcodes, or Product Names will update existing prices. New rows will automatically create new products in the catalog.
                  </p>
                </div>
              </div>

              {/* Preview of Parsed CSV Rows */}
              {parsedCsvRows.length > 0 && (
                <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h5 className="font-montserrat font-black text-sm text-[#1E9E60]">
                        CSV Price List Preview ({parsedCsvRows.length} Rows Ready to Apply)
                      </h5>
                      <p className="text-xs text-emerald-900">
                        Verify the parsed Warehouse Cost, Wholesale Price, and Retail Price values below before applying.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setParsedCsvRows([]);
                          setCsvFileName('');
                          setRawCsvPaste('');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-white text-slate-700 border border-slate-300 text-xs font-bold"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={handleApplyParsedCsv}
                        className="px-5 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Apply CSV Price List Now ({parsedCsvRows.length} Rows)</span>
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto bg-white rounded-xl border border-emerald-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-emerald-100/80 text-[#1E9E60] font-montserrat font-black text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="py-2 px-3">SKU / Barcode</th>
                          <th className="py-2 px-3">Product Name</th>
                          <th className="py-2 px-3">Brand</th>
                          <th className="py-2 px-3">Cat / Vol</th>
                          <th className="py-2 px-3 text-right">Cost (KES)</th>
                          <th className="py-2 px-3 text-right">Wholesale (KES)</th>
                          <th className="py-2 px-3 text-right">Retail (KES)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {parsedCsvRows.slice(0, 50).map((r, i) => (
                          <tr key={i}>
                            <td className="py-2 px-3 text-[11px]">{r.sku || r.barcode || 'AUTO'}</td>
                            <td className="py-2 px-3 font-sans font-bold text-slate-900">{r.name || '(Brand-Wide Rule)'}</td>
                            <td className="py-2 px-3 font-sans font-semibold text-[#0A006E]">{r.brand || '—'}</td>
                            <td className="py-2 px-3 text-[11px]">
                              {r.category || 'IPS'} • {r.volumeMl || 750}mL
                            </td>
                            <td className="py-2 px-3 text-right">{r.warehouseCostKes ? formatKes(r.warehouseCostKes) : 'Auto'}</td>
                            <td className="py-2 px-3 text-right">{r.wholesalePriceKes ? formatKes(r.wholesalePriceKes) : 'Auto'}</td>
                            <td className="py-2 px-3 text-right font-bold text-[#1E9E60]">
                              {r.retailPriceKes ? formatKes(r.retailPriceKes) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MODE B: MANUAL BRAND PRICES & BULK BRAND PRICING */}
          {pricingMode === 'MANUAL_BRAND' && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveBrandPricingRule}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-montserrat font-black text-sm text-[#0A006E]">
                      Set or Update Brand Prices Manually
                    </h4>
                    <p className="text-xs text-slate-600">
                      Select an existing brand or type a new brand name to set its baseline Warehouse Cost, Wholesale Price, and Retail Price.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-bold text-[#1E9E60] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={applyBrandToExisting}
                      onChange={e => setApplyBrandToExisting(e.target.checked)}
                      className="rounded border-slate-300 text-[#1E9E60]"
                    />
                    <span>Apply immediately to all products under this Brand</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Brand Name (Select or Type New) *
                    </label>
                    <input
                      type="text"
                      list="erp-brands-list"
                      required
                      value={brandRuleName}
                      onChange={e => setBrandRuleName(e.target.value)}
                      placeholder="e.g. Johnnie Walker, Hennessy, Tusker..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    />
                    <datalist id="erp-brands-list">
                      {allBrands.map(b => (
                        <option key={b} value={b} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Stock Category</label>
                    <select
                      value={brandRuleCategory}
                      onChange={e => setBrandRuleCategory(e.target.value as StockCategory)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                    >
                      <option value="IPS">IPS (Imported)</option>
                      <option value="LPS">LPS (Local)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Warehouse Cost (KES) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={brandRuleCostKes}
                      onChange={e => setBrandRuleCostKes(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Wholesale Price (KES) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={brandRuleWholesaleKes}
                      onChange={e => setBrandRuleWholesaleKes(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#0A006E]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Retail Price (KES) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={brandRuleRetailKes}
                      onChange={e => setBrandRuleRetailKes(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border-2 border-[#34D186] rounded-xl text-xs font-mono font-black text-[#1E9E60]"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Origin:</span>
                      <input
                        type="text"
                        value={brandRuleCountry}
                        onChange={e => setBrandRuleCountry(e.target.value)}
                        className="w-28 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Std Volume (mL):</span>
                      <input
                        type="number"
                        value={brandRuleVolMl}
                        onChange={e => setBrandRuleVolMl(parseInt(e.target.value, 10) || 750)}
                        className="w-20 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-600 font-semibold">Min Wholesale Btls:</span>
                      <input
                        type="number"
                        value={brandRuleMinQty}
                        onChange={e => setBrandRuleMinQty(parseInt(e.target.value, 10) || 6)}
                        className="w-16 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Brand Price Configuration</span>
                  </button>
                </div>
              </form>

              {/* All Brands Price Directory */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-montserrat font-black text-[10px] uppercase">
                    <tr>
                      <th className="py-3 px-4">Brand Name</th>
                      <th className="py-3 px-3">Category / Origin</th>
                      <th className="py-3 px-3 text-center">Products</th>
                      <th className="py-3 px-3 text-right">Avg Warehouse Cost</th>
                      <th className="py-3 px-3 text-right">Avg Wholesale Price</th>
                      <th className="py-3 px-3 text-right">Avg Retail Price</th>
                      <th className="py-3 px-4 text-right">Quick Brand Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {brandSummaries.map(b => (
                      <tr key={b.brandName} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-montserrat font-black text-slate-900">{b.brandName}</td>
                        <td className="py-3 px-3 text-slate-600">
                          <span className="font-mono font-bold text-[#0A006E]">{b.category}</span> • {b.countryOfOrigin}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">{b.productCount} SKUs</td>
                        <td className="py-3 px-3 text-right font-mono">{formatKes(b.avgCost)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-[#0A006E]">
                          {formatKes(b.avgWholesale)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-[#1E9E60]">
                          {formatKes(b.avgRetail)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBrandRuleName(b.brandName);
                                setBrandRuleCategory(b.category as StockCategory);
                                setBrandRuleCountry(b.countryOfOrigin);
                                setBrandRuleCostKes(b.avgCost);
                                setBrandRuleWholesaleKes(b.avgWholesale);
                                setBrandRuleRetailKes(b.avgRetail);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#0A006E] hover:text-[#FFDE00] text-slate-800 font-montserrat font-bold text-[10px] transition cursor-pointer"
                            >
                              Edit Brand Price
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const count = bulkUpdateBrandPrices(b.brandName, { percentageChange: 5 });
                                showFeedback(`Increased all ${count} products under "${b.brandName}" by +5%.`);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#1E9E60] border border-emerald-200 font-mono font-bold text-[10px] cursor-pointer"
                              title="Increase all prices for this brand by +5%"
                            >
                              +5%
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBrandFilter(b.brandName);
                                setPricingMode('MANUAL_PRODUCT');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-[#FFDE00]/30 hover:bg-[#FFDE00] text-[#0A006E] font-montserrat font-bold text-[10px] cursor-pointer"
                            >
                              View SKUs
                            </button>
                            {b.ruleId && (
                              <button
                                type="button"
                                onClick={() => deleteBrandPriceRule(b.ruleId!)}
                                className="p-1 text-red-500 hover:text-red-700"
                                title="Remove custom brand rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODE C: MANUAL PRODUCT PRICES & INLINE PRICE EDITOR */}
          {pricingMode === 'MANUAL_PRODUCT' && (
            <div className="space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={priceSearch}
                      onChange={e => setPriceSearch(e.target.value)}
                      placeholder="Search product name, SKU, barcode, or brand..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                    />
                  </div>

                  <select
                    value={selectedBrandFilter}
                    onChange={e => setSelectedBrandFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="ALL">All Brands ({allBrands.length})</option>
                    {allBrands.map(b => (
                      <option key={b} value={b}>
                        Brand: {b}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedCategoryFilter}
                    onChange={e => setSelectedCategoryFilter(e.target.value as 'ALL' | 'IPS' | 'LPS')}
                    className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="IPS">IPS (Imported)</option>
                    <option value="LPS">LPS (Local)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  {Object.keys(inlineEdits).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const entries = Object.entries(inlineEdits);
                        entries.forEach(([prodId, edit]) => {
                          updateProduct(prodId, {
                            brand: edit.brand,
                            warehouseCostKes: edit.warehouseCostKes,
                            wholesalePriceKes: edit.wholesalePriceKes,
                            retailPriceKes: edit.retailPriceKes,
                            minWholesaleQty: edit.minWholesaleQty
                          });
                        });
                        setInlineEdits({});
                        showFeedback(`Saved manual price updates for ${entries.length} product(s).`);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save All Edited Prices ({Object.keys(inlineEdits).length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowNewProductForm(prev => !prev)}
                    className="px-4 py-2 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{showNewProductForm ? 'Close Form' : '+ Add Product & Set Price'}</span>
                  </button>
                </div>
              </div>

              {showNewProductForm && (
                <form
                  onSubmit={handleCreateManualProductAndPrice}
                  className="p-5 rounded-2xl bg-slate-50 border-2 border-[#0A006E]/20 space-y-3"
                >
                  <div className="font-montserrat font-black text-xs text-[#0A006E] uppercase">
                    Manual New Product &amp; Price Entry
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Brand *</label>
                      <input
                        type="text"
                        required
                        list="erp-brands-list"
                        value={newProdBrand}
                        onChange={e => setNewProdBrand(e.target.value)}
                        placeholder="e.g. Hennessy"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Product Name *</label>
                      <input
                        type="text"
                        required
                        value={newProdName}
                        onChange={e => setNewProdName(e.target.value)}
                        placeholder="e.g. Hennessy VSOP Privilege (750ml)"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Cost Price (KES) *</label>
                      <input
                        type="number"
                        required
                        value={newProdCostKes}
                        onChange={e => setNewProdCostKes(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Wholesale (KES) *</label>
                      <input
                        type="number"
                        required
                        value={newProdWholesaleKes}
                        onChange={e => setNewProdWholesaleKes(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#0A006E]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Retail Price (KES) *</label>
                      <input
                        type="number"
                        required
                        value={newProdRetailKes}
                        onChange={e => setNewProdRetailKes(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 bg-white border-2 border-[#34D186] rounded-xl text-xs font-mono font-black text-[#1E9E60]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <select
                        value={newProdCategory}
                        onChange={e => setNewProdCategory(e.target.value as StockCategory)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                      >
                        <option value="IPS">IPS (Imported)</option>
                        <option value="LPS">LPS (Local)</option>
                      </select>
                      <input
                        type="text"
                        value={newProdSku}
                        onChange={e => setNewProdSku(e.target.value)}
                        placeholder="SKU (Optional)"
                        className="w-32 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="text"
                        value={newProdBarcode}
                        onChange={e => setNewProdBarcode(e.target.value)}
                        placeholder="Barcode (Optional)"
                        className="w-36 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                      <input
                        type="number"
                        value={newProdVolumeMl}
                        onChange={e => setNewProdVolumeMl(parseInt(e.target.value, 10) || 750)}
                        placeholder="Volume mL"
                        className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#34D186] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Save New Product &amp; Prices</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Inline Editable Product & Brand Prices Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[540px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-white font-montserrat font-black text-[10px] uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-3">Product &amp; SKU</th>
                      <th className="py-3 px-3">Brand</th>
                      <th className="py-3 px-2 text-center">Vol / Cat</th>
                      <th className="py-3 px-3 text-right">Warehouse Cost (KES)</th>
                      <th className="py-3 px-3 text-right">Wholesale Price (KES)</th>
                      <th className="py-3 px-3 text-right">Retail Price (KES)</th>
                      <th className="py-3 px-2 text-center">Min Whls Qty</th>
                      <th className="py-3 px-3 text-right">Save</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredProducts.slice(0, 80).map(prod => {
                      const draft = inlineEdits[prod.id] || {
                        brand: prod.brand,
                        warehouseCostKes: prod.warehouseCostKes,
                        wholesalePriceKes: prod.wholesalePriceKes,
                        retailPriceKes: prod.retailPriceKes,
                        minWholesaleQty: prod.minWholesaleQty
                      };
                      const isEdited = Boolean(inlineEdits[prod.id]);

                      const updateDraft = (patch: Partial<typeof draft>) => {
                        setInlineEdits(prev => ({
                          ...prev,
                          [prod.id]: {
                            ...draft,
                            ...patch
                          }
                        }));
                      };

                      return (
                        <tr key={prod.id} className={isEdited ? 'bg-amber-50/70' : 'hover:bg-slate-50/80'}>
                          <td className="py-2.5 px-3">
                            <div className="font-montserrat font-bold text-slate-900">{prod.name}</div>
                            <div className="text-[10px] font-mono text-slate-500">
                              {prod.sku} • {prod.barcode}
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={draft.brand}
                              onChange={e => updateDraft({ brand: e.target.value })}
                              className="w-32 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-[#0A006E]"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono text-[11px]">
                            {prod.volumeMl}mL • <strong>{prod.category}</strong>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={draft.warehouseCostKes}
                              onChange={e => updateDraft({ warehouseCostKes: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-right font-mono font-bold text-slate-800"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={draft.wholesalePriceKes}
                              onChange={e => updateDraft({ wholesalePriceKes: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-2 py-1 bg-white border border-[#0A006E]/40 rounded-lg text-right font-mono font-bold text-[#0A006E]"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <input
                              type="number"
                              min={0}
                              value={draft.retailPriceKes}
                              onChange={e => updateDraft({ retailPriceKes: parseFloat(e.target.value) || 0 })}
                              className="w-24 px-2 py-1 bg-white border-2 border-[#34D186] rounded-lg text-right font-mono font-black text-[#1E9E60]"
                            />
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <input
                              type="number"
                              min={1}
                              value={draft.minWholesaleQty}
                              onChange={e => updateDraft({ minWholesaleQty: parseInt(e.target.value, 10) || 1 })}
                              className="w-14 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono text-xs"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                updateProduct(prod.id, {
                                  brand: draft.brand,
                                  warehouseCostKes: draft.warehouseCostKes,
                                  wholesalePriceKes: draft.wholesalePriceKes,
                                  retailPriceKes: draft.retailPriceKes,
                                  minWholesaleQty: draft.minWholesaleQty
                                });
                                setInlineEdits(prev => {
                                  const copy = { ...prev };
                                  delete copy[prod.id];
                                  return copy;
                                });
                                showFeedback(
                                  `Updated prices for "${prod.name}" → Cost: ${formatKes(draft.warehouseCostKes)}, Wholesale: ${formatKes(draft.wholesalePriceKes)}, Retail: ${formatKes(draft.retailPriceKes)}`
                                );
                              }}
                              className={`px-3 py-1 rounded-lg font-montserrat font-black text-[10px] transition cursor-pointer ${
                                isEdited
                                  ? 'bg-[#34D186] text-[#FFDE00] shadow-xs'
                                  : 'bg-slate-100 hover:bg-[#0A006E] text-slate-700 hover:text-white'
                              }`}
                            >
                              Save
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: BRAND SETTING (ENTERPRISE IDENTITY & COMPANY PROFILE)
      ===================================================================== */}
      {activeSubTab === 'BRAND_SETTINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              Brand Setting &amp; Enterprise Identity
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your platform Brand Name, Badge, Tagline, Storefront Title, Corporate Details, and Brand Color Palette. Changes reflect live across the Header, Receipts, and Storefront.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Primary Brand Title *
              </label>
              <input
                type="text"
                value={systemSettings.brandName}
                onChange={e => updateSystemSettings({ brandName: e.target.value })}
                placeholder="VAAIRO"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-montserrat font-black text-[#0A006E]"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Brand Pill Badge
              </label>
              <input
                type="text"
                value={systemSettings.brandBadge}
                onChange={e => updateSystemSettings({ brandBadge: e.target.value })}
                placeholder="ERP"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-montserrat font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Brand Tagline / Subtitle
              </label>
              <input
                type="text"
                value={systemSettings.brandTagline}
                onChange={e => updateSystemSettings({ brandTagline: e.target.value })}
                placeholder="Kenyan Alcohol Distribution & POS Platform"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Legal Company Name (For KRA Tax Invoices)
              </label>
              <input
                type="text"
                value={systemSettings.legalCompanyName}
                onChange={e => updateSystemSettings({ legalCompanyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Online Customer Storefront Title
              </label>
              <input
                type="text"
                value={systemSettings.storefrontTitle}
                onChange={e => updateSystemSettings({ storefrontTitle: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Customer Support Hotline
              </label>
              <input
                type="text"
                value={systemSettings.supportPhone}
                onChange={e => updateSystemSettings({ supportPhone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Official Support Email
              </label>
              <input
                type="email"
                value={systemSettings.supportEmail}
                onChange={e => updateSystemSettings({ supportEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-montserrat font-bold text-slate-700 mb-1">
                Head Office Physical Address
              </label>
              <input
                type="text"
                value={systemSettings.headOfficeAddress}
                onChange={e => updateSystemSettings({ headOfficeAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Brand Color Theme Pickers */}
          <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-montserrat font-black text-slate-900">Primary Brand Color</div>
                <div className="text-[11px] font-mono text-slate-500">{systemSettings.primaryColorHex}</div>
              </div>
              <input
                type="color"
                value={systemSettings.primaryColorHex}
                onChange={e => updateSystemSettings({ primaryColorHex: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-montserrat font-black text-slate-900">Gold Accent Color</div>
                <div className="text-[11px] font-mono text-slate-500">{systemSettings.accentColorHex}</div>
              </div>
              <input
                type="color"
                value={systemSettings.accentColorHex}
                onChange={e => updateSystemSettings({ accentColorHex: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-montserrat font-black text-slate-900">Secondary Emerald Color</div>
                <div className="text-[11px] font-mono text-slate-500">{systemSettings.secondaryColorHex}</div>
              </div>
              <input
                type="color"
                value={systemSettings.secondaryColorHex}
                onChange={e => updateSystemSettings({ secondaryColorHex: e.target.value })}
                className="w-10 h-10 rounded-lg cursor-pointer border border-slate-300"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showFeedback('Brand Identity & Company Settings saved and synced live.')}
              className="px-6 py-3 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Brand Settings</span>
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: LOGO & FAVICON SETTING
      ===================================================================== */}
      {activeSubTab === 'LOGO_FAVICON' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              Logo &amp; Favicon Setting
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload your custom Enterprise Brand Logo and Browser Tab Favicon (PNG, SVG, JPG, WebP, or ICO) or enter an image URL.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Brand Logo Card */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-montserrat font-black text-sm text-[#0A006E]">
                    1. Enterprise Header &amp; Receipt Brand Logo
                  </h4>
                  <p className="text-xs text-slate-500">
                    Displayed in the top navigation bar, login screen, and customer storefront.
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-[#0A006E] border-2 border-[#FFDE00] flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {systemSettings.logoUrl ? (
                    <img
                      src={systemSettings.logoUrl}
                      alt="Brand Logo"
                      className="w-full h-full object-contain bg-white p-1"
                    />
                  ) : (
                    <Wine className="w-8 h-8 text-[#FFDE00]" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Logo Image URL or Data URI
                </label>
                <input
                  type="text"
                  value={systemSettings.logoUrl}
                  onChange={e => updateSystemSettings({ logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png or upload file below"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-4 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 cursor-pointer shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Upload Logo Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => handleImageUploadToSetting(e, 'logoUrl')}
                    className="hidden"
                  />
                </label>

                {systemSettings.logoUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSystemSettings({ logoUrl: '' });
                      showFeedback('Reset to default VAAIRO Wine emblem logo.');
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset to Default Icon</span>
                  </button>
                )}
              </div>
            </div>

            {/* Browser Favicon Card */}
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-montserrat font-black text-sm text-[#1E9E60]">
                    2. Browser Tab Favicon Setting
                  </h4>
                  <p className="text-xs text-slate-500">
                    Updates the browser tab favicon icon (&lt;link rel=&quot;icon&quot;&gt;) dynamically across the application.
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white border-2 border-slate-300 flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                  {systemSettings.faviconUrl ? (
                    <img
                      src={systemSettings.faviconUrl}
                      alt="Favicon"
                      className="w-9 h-9 object-contain"
                    />
                  ) : (
                    <Wine className="w-7 h-7 text-[#0A006E]" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Favicon Image URL (.png, .svg, .ico)
                </label>
                <input
                  type="text"
                  value={systemSettings.faviconUrl}
                  onChange={e => updateSystemSettings({ faviconUrl: e.target.value })}
                  placeholder="https://example.com/favicon.png or upload file below"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <label className="px-4 py-2.5 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 cursor-pointer shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Upload Favicon File</span>
                  <input
                    type="file"
                    accept="image/*,.ico"
                    onChange={e => handleImageUploadToSetting(e, 'faviconUrl')}
                    className="hidden"
                  />
                </label>

                {systemSettings.faviconUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      updateSystemSettings({ faviconUrl: '' });
                      showFeedback('Cleared custom favicon URL.');
                    }}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-red-50 text-red-600 border border-slate-200 text-xs font-bold cursor-pointer"
                  >
                    Reset Favicon
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: OFFERS SETTING
      ===================================================================== */}
      {activeSubTab === 'OFFERS_SETTINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              Special Offers Setting
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Create and manage special product or brand offers (Percentage Off, Fixed Offer Price, Buy X Get Y, Case Bundle Deals, and Happy Hour Offers).
            </p>
          </div>

          <form onSubmit={handleCreateOffer} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Offer Title *</label>
                <input
                  type="text"
                  required
                  value={offerTitle}
                  onChange={e => setOfferTitle(e.target.value)}
                  placeholder="e.g. Weekend Whisky 10% Off"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Offer Type</label>
                <select
                  value={offerType}
                  onChange={e => setOfferType(e.target.value as typeof offerType)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="PERCENTAGE_OFF">Percentage Discount (%)</option>
                  <option value="DISCOUNT_PRICE">Special Offer Price (KES)</option>
                  <option value="BUY_X_GET_Y">Buy X Get Y Deal</option>
                  <option value="CASE_BUNDLE_DEAL">Master Case Bundle Deal</option>
                  <option value="HAPPY_HOUR">Happy Hour Flash Offer</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Scope</label>
                <select
                  value={offerScope}
                  onChange={e => setOfferScope(e.target.value as typeof offerScope)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="BRAND">Specific Brand</option>
                  <option value="PRODUCT">Specific Product</option>
                  <option value="ALL_CATALOG">Entire Catalog</option>
                </select>
              </div>

              {offerScope === 'BRAND' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Brand</label>
                  <select
                    value={offerBrand}
                    onChange={e => setOfferBrand(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {allBrands.map(b => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {offerScope === 'PRODUCT' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Select Product</label>
                  <select
                    value={offerProductId}
                    onChange={e => setOfferProductId(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                  >
                    {products.slice(0, 100).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({formatKes(p.retailPriceKes)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              {offerType === 'PERCENTAGE_OFF' ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={offerDiscountPct}
                    onChange={e => setOfferDiscountPct(parseFloat(e.target.value) || 5)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Offer Price (KES)</label>
                  <input
                    type="number"
                    min={10}
                    value={offerPriceKes}
                    onChange={e => setOfferPriceKes(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Min Bottles Qty</label>
                <input
                  type="number"
                  min={1}
                  value={offerMinQty}
                  onChange={e => setOfferMinQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Channel</label>
                <select
                  value={offerChannel}
                  onChange={e => setOfferChannel(e.target.value as typeof offerChannel)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="ALL">POS &amp; Online Storefront</option>
                  <option value="POS_ONLY">POS Branches Only</option>
                  <option value="STOREFRONT_ONLY">Online Storefront Only</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={offerEndDate}
                  onChange={e => setOfferEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Offer</span>
              </button>
            </div>
          </form>

          {specialOffers.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No special offers configured yet. Use the form above to create product or brand offers.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {specialOffers.map(offer => (
                <div
                  key={offer.id}
                  className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${
                    offer.active ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200 opacity-65'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-montserrat font-black text-[10px]">
                        {offer.offerType.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">Until {offer.endDate}</span>
                    </div>
                    <h4 className="font-montserrat font-black text-sm text-slate-900">{offer.title}</h4>
                    <p className="text-xs text-slate-600">
                      Target:{' '}
                      <strong>
                        {offer.targetScope === 'BRAND'
                          ? `Brand: ${offer.targetBrand}`
                          : offer.targetScope === 'PRODUCT'
                          ? offer.targetProductName || 'Product'
                          : 'Entire Catalog'}
                      </strong>{' '}
                      • Min Qty: {offer.minQuantity}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 text-xs">
                    <span className="font-montserrat font-black text-[#1E9E60]">
                      {offer.discountPercent
                        ? `${offer.discountPercent}% OFF`
                        : offer.offerPriceKes
                        ? formatKes(offer.offerPriceKes)
                        : offer.badgeLabel}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveSpecialOffer({ ...offer, active: !offer.active })}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[10px] font-bold"
                      >
                        {offer.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteSpecialOffer(offer.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 5: CAMPAIGN SETTING
      ===================================================================== */}
      {activeSubTab === 'CAMPAIGN_SETTINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              Marketing &amp; Sales Campaign Setting
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Launch and track seasonal alcohol distribution campaigns, brand activations, and branch sales drives.
            </p>
          </div>

          <form onSubmit={handleCreateCampaign} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={campName}
                  onChange={e => setCampName(e.target.value)}
                  placeholder="e.g. Festive Spirits Drive 2026"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Campaign Code</label>
                <input
                  type="text"
                  value={campCode}
                  onChange={e => setCampCode(e.target.value.toUpperCase())}
                  placeholder="CMP-FESTIVE-01"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Channel</label>
                <select
                  value={campChannel}
                  onChange={e => setCampChannel(e.target.value as typeof campChannel)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="OMNICHANNEL">Omnichannel (All Branches &amp; Web)</option>
                  <option value="POS_BRANCHES">Retail Liquor Store POS</option>
                  <option value="ONLINE_STOREFRONT">Online Storefront Delivery</option>
                  <option value="WHOLESALE_DISTRIBUTORS">Wholesale &amp; Merchants</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Featured Brand (Optional)</label>
                <input
                  type="text"
                  list="erp-brands-list"
                  value={campBrand}
                  onChange={e => setCampBrand(e.target.value)}
                  placeholder="e.g. Hennessy, Diageo..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Banner Headline / Message</label>
                <input
                  type="text"
                  value={campHeadline}
                  onChange={e => setCampHeadline(e.target.value)}
                  placeholder="e.g. Free Express Delivery on All Single Malt Orders!"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Budget (KES)</label>
                <input
                  type="number"
                  value={campBudgetKes}
                  onChange={e => setCampBudgetKes(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Revenue (KES)</label>
                <input
                  type="number"
                  value={campTargetRevenueKes}
                  onChange={e => setCampTargetRevenueKes(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-[#1E9E60]"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Megaphone className="w-4 h-4" />
                <span>Launch Campaign</span>
              </button>
            </div>
          </form>

          {marketingCampaigns.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No active campaigns yet. Launch your first sales or brand campaign above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {marketingCampaigns.map(camp => (
                <div
                  key={camp.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-xs text-[#0A006E]">{camp.campaignCode}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-montserrat font-black ${
                          camp.active ? 'bg-emerald-100 text-[#1E9E60]' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {camp.active ? 'ACTIVE CAMPAIGN' : 'PAUSED'}
                      </span>
                    </div>
                    <h4 className="font-montserrat font-black text-base text-slate-900 mt-1">{camp.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">{camp.headline}</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div className="font-mono text-[11px] text-slate-600">
                      Budget: <strong>{formatKes(camp.budgetKes)}</strong> • Target:{' '}
                      <strong className="text-[#1E9E60]">{formatKes(camp.targetRevenueKes)}</strong>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveMarketingCampaign({ ...camp, active: !camp.active })}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-300 text-[10px] font-bold"
                      >
                        {camp.active ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMarketingCampaign(camp.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 6: PROMOTION SETTING
      ===================================================================== */}
      {activeSubTab === 'PROMOTION_SETTINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              Promotions &amp; Promo Codes Setting
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure promotional discount codes and automatic POS / Storefront order promotions.
            </p>
          </div>

          <form onSubmit={handleCreatePromotion} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
              <div className="lg:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Promotion Name *</label>
                <input
                  type="text"
                  required
                  value={promoName}
                  onChange={e => setPromoName(e.target.value)}
                  placeholder="e.g. VIP Holiday 10% Discount"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Promo Code *</label>
                <input
                  type="text"
                  required
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="VAAIRO10"
                  className="w-full px-3 py-2 bg-white border border-[#0A006E] rounded-xl text-xs font-mono font-black text-[#0A006E]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Discount Type</label>
                <select
                  value={promoDiscountType}
                  onChange={e => setPromoDiscountType(e.target.value as 'PERCENTAGE' | 'FIXED_KES')}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold"
                >
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_KES">Fixed Amount (KES)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {promoDiscountType === 'PERCENTAGE' ? 'Discount (%)' : 'Discount (KES)'}
                </label>
                <input
                  type="number"
                  min={1}
                  value={promoDiscountValue}
                  onChange={e => setPromoDiscountValue(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] font-montserrat font-black text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Promotion</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-semibold">Min Order (KES):</span>
                  <input
                    type="number"
                    value={promoMinOrderKes}
                    onChange={e => setPromoMinOrderKes(parseFloat(e.target.value) || 0)}
                    className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-600 font-semibold">Valid Until:</span>
                  <input
                    type="date"
                    value={promoValidUntil}
                    onChange={e => setPromoValidUntil(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <label className="flex items-center gap-1.5 font-bold text-[#1E9E60] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={promoAutoApplyPos}
                    onChange={e => setPromoAutoApplyPos(e.target.checked)}
                    className="rounded border-slate-300 text-[#1E9E60]"
                  />
                  <span>Auto-Apply on Eligible POS Orders</span>
                </label>
              </div>
            </div>
          </form>

          {promotions.length === 0 ? (
            <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No promotions created yet. Use the form above to add promo codes and automatic discounts.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {promotions.map(promo => (
                <div
                  key={promo.id}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded bg-[#0A006E] text-[#FFDE00] font-mono font-black text-xs">
                        {promo.promoCode}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">Exp: {promo.validUntil}</span>
                    </div>
                    <h4 className="font-montserrat font-black text-sm text-slate-900 mt-1.5">{promo.name}</h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {promo.discountType === 'PERCENTAGE'
                        ? `${promo.discountValue}% OFF`
                        : `${formatKes(promo.discountValue)} OFF`}{' '}
                      • Min Order: {formatKes(promo.minOrderAmountKes)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                    <span className="text-[10px] font-bold text-[#1E9E60]">
                      {promo.autoApplyAtPos ? 'Auto-Apply at POS' : 'Promo Code Entry'}
                    </span>
                    <button
                      type="button"
                      onClick={() => deletePromotion(promo.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 7: 16% VAT ENFORCEMENT, M-PESA & OTHER RELEVANT SETTINGS
      ===================================================================== */}
      {activeSubTab === 'OTHER_SETTINGS' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-montserrat font-black text-lg sm:text-xl text-slate-900">
              TOTP (2FA) Authenticator, 16% VAT Enforcement, M-Pesa &amp; POS Settings
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enroll your Google/Microsoft Authenticator app (RFC 6238 TOTP), configure mandatory 16% VAT enforcement, M-Pesa Paybill/Till, and POS permissions.
            </p>
          </div>

          {/* RFC 6238 TOTP (2FA) AUTHENTICATOR SETUP & ACTIVATION PANEL */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#0A006E] to-slate-900 text-white border-2 border-[#FFDE00] shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFDE00] text-[#0A006E] flex items-center justify-center shrink-0 font-black">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="font-montserrat font-black text-sm sm:text-base text-white">
                      Authenticator App (RFC 6238 TOTP 2FA) Setup
                    </h4>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-montserrat font-black uppercase ${
                        totpEnabled
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-400 text-[#0A006E]'
                      }`}
                    >
                      {totpEnabled ? 'ACTIVE & ENFORCED' : 'NOT YET ACTIVATED'}
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Protect Super Admin &amp; Manager Google sign-ins with a 6-digit Time-based One-Time Password from Google Authenticator, Microsoft Authenticator, or Authy.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!totpPendingSecret && (
                  <button
                    type="button"
                    disabled={isTotpLoading}
                    onClick={handleInitTotpSetup}
                    className="px-4 py-2.5 rounded-xl bg-[#FFDE00] hover:bg-yellow-300 text-[#0A006E] font-montserrat font-black text-xs cursor-pointer transition shadow-sm"
                  >
                    {totpEnabled ? 'Reset / Re-Enroll TOTP Key' : 'Generate Setup Key & Start TOTP'}
                  </button>
                )}
                {totpEnabled && (
                  <button
                    type="button"
                    disabled={isTotpLoading}
                    onClick={handleDisableTotp}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-red-600 text-white font-montserrat font-bold text-xs cursor-pointer transition"
                  >
                    Disable TOTP
                  </button>
                )}
              </div>
            </div>

            {totpStatusMessage && (
              <div
                className={`p-3 rounded-xl text-xs font-montserrat font-bold flex items-center justify-between gap-2 ${
                  totpStatusMessage.ok
                    ? 'bg-emerald-500/20 border border-emerald-400/50 text-emerald-200'
                    : 'bg-red-500/20 border border-red-400/50 text-red-200'
                }`}
              >
                <span>{totpStatusMessage.text}</span>
              </div>
            )}

            {totpPendingSecret && (
              <div className="p-4 rounded-2xl bg-white text-slate-900 space-y-4 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                  {/* QR Code for Authenticator App */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                        totpOtpauthUrl
                      )}`}
                      alt="TOTP Authenticator QR Code"
                      className="w-36 h-36 rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <span className="text-[10px] font-montserrat font-bold text-slate-500 mt-1.5 text-center">
                      Scan with Google Authenticator or Authy
                    </span>
                  </div>

                  {/* Step-by-Step Setup Key + 6-Digit Verification */}
                  <div className="md:col-span-8 space-y-3">
                    <div>
                      <div className="text-[11px] font-montserrat font-black uppercase text-[#0A006E]">
                        Step 1: Scan QR Code or Enter Base32 Setup Key in Authenticator App
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <code className="flex-1 px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 font-mono font-black text-sm tracking-widest text-[#0A006E] select-all">
                          {totpPendingSecret}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(totpPendingSecret);
                            showFeedback('TOTP Base32 Setup Key copied to clipboard!');
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-montserrat font-bold text-xs cursor-pointer"
                        >
                          Copy Key
                        </button>
                      </div>
                    </div>

                    <form onSubmit={handleVerifyAndActivateTotp} className="space-y-2 pt-1">
                      <label className="block text-[11px] font-montserrat font-black uppercase text-[#0A006E]">
                        Step 2: Enter the 6-Digit Code from Your Authenticator App to Activate
                      </label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={totpVerifyCode}
                          onChange={e => setTotpVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="w-full sm:w-48 px-4 py-2.5 rounded-xl bg-slate-50 border-2 border-[#0A006E] font-mono font-black text-base tracking-[0.35em] text-center text-[#0A006E]"
                        />
                        <button
                          type="submit"
                          disabled={isTotpLoading || totpVerifyCode.length !== 6}
                          className="px-5 py-2.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] disabled:opacity-50 text-[#FFDE00] font-montserrat font-black text-xs cursor-pointer transition shadow-md"
                        >
                          Verify &amp; Activate TOTP
                        </button>
                        <button
                          type="button"
                          onClick={() => setTotpPendingSecret('')}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-montserrat font-bold text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Mandatory 16% VAT & Statutory Tax */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2 text-[#0A006E] font-montserrat font-black text-xs uppercase">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>16% VAT Enforcement</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#34D186] text-white text-[9px] font-black">
                  ENFORCED
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Company Tax PIN</label>
                <input
                  type="text"
                  value={systemSettings.companyKraPin}
                  onChange={e => updateSystemSettings({ companyKraPin: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Enforced VAT Rate (%)</label>
                  <input
                    type="number"
                    value={systemSettings.defaultVatRatePercent}
                    onChange={e => updateSystemSettings({ defaultVatRatePercent: parseFloat(e.target.value) || 16 })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Excise / Litre (KES)</label>
                  <input
                    type="number"
                    value={systemSettings.defaultExciseDutyPerLitreKes}
                    onChange={e =>
                      updateSystemSettings({ defaultExciseDutyPerLitreKes: parseFloat(e.target.value) || 356.4 })
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">VAT Register Reference</label>
                <input
                  type="text"
                  value={systemSettings.etimsDeviceSerial}
                  onChange={e => updateSystemSettings({ etimsDeviceSerial: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            {/* M-Pesa Daraja & Payment Settings */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-[#1E9E60] font-montserrat font-black text-xs uppercase">
                <Smartphone className="w-4 h-4" />
                <span>M-Pesa Daraja &amp; Wholesale Thresholds</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  M-Pesa Paybill / Buy Goods Till Number
                </label>
                <input
                  type="text"
                  value={systemSettings.mpesaPaybillOrTill}
                  onChange={e => updateSystemSettings({ mpesaPaybillOrTill: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Default Min Wholesale Order Threshold (KES)
                </label>
                <input
                  type="number"
                  value={systemSettings.defaultMinWholesaleKes}
                  onChange={e => updateSystemSettings({ defaultMinWholesaleKes: parseFloat(e.target.value) || 50000 })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Default Counter Cashier Commission (%)
                </label>
                <input
                  type="number"
                  step={0.5}
                  value={systemSettings.defaultCounterCashierCommissionPercent}
                  onChange={e =>
                    updateSystemSettings({
                      defaultCounterCashierCommissionPercent: parseFloat(e.target.value) || 3
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* POS Counter Cashier Workflow & Thermal Receipt Settings */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-[#0A006E] font-montserrat font-black text-xs uppercase">
                <Store className="w-4 h-4" />
                <span>Counter Cashier &amp; Receipt Settings</span>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemSettings.allowCashierDirectSales}
                  onChange={e => updateSystemSettings({ allowCashierDirectSales: e.target.checked })}
                  className="rounded border-slate-300 text-[#0A006E]"
                />
                <span>Allow Counter Cashier Direct Walk-In Sales</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemSettings.allowCashierReceiveSalesRepOrders}
                  onChange={e => updateSystemSettings({ allowCashierReceiveSalesRepOrders: e.target.checked })}
                  className="rounded border-slate-300 text-[#1E9E60]"
                />
                <span>Allow Counter Cashier to Receive Orders from Sales Reps</span>
              </label>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  80mm Thermal Receipt Footer Message
                </label>
                <input
                  type="text"
                  value={systemSettings.receiptFooterMessage}
                  onChange={e => updateSystemSettings({ receiptFooterMessage: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => showFeedback('16% VAT Enforcement, M-Pesa & POS Settings saved.')}
              className="px-6 py-3 rounded-xl bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] font-montserrat font-black text-xs flex items-center gap-2 shadow-md cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Operational Settings</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
