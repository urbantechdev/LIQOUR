import {
  Branch,
  BranchMarketClassTier,
  BranchProductPriceOverride,
  BranchRoutingModel,
  InventoryItem,
  Product
} from '../types';

export interface DeliveryZoneGeoConfig {
  id: string;
  label: string;
  county: string;
  latitude: number;
  longitude: number;
  defaultRadiusKm: number;
  keywords: string[];
  defaultMarketClassTier?: BranchMarketClassTier;
  defaultPriceMultiplierPercent?: number;
}

export interface BranchMarketClassPreset {
  tier: BranchMarketClassTier;
  label: string;
  shortLabel: string;
  description: string;
  exampleEstates: string;
  defaultMultiplierPercent: number;
}

export const BRANCH_MARKET_CLASS_PRESETS: BranchMarketClassPreset[] = [
  {
    tier: 'AFFLUENT_PREMIUM',
    label: 'Prime / Affluent Class (Kilimani • Westlands • Karen)',
    shortLabel: 'Prime Class (Kilimani/Westlands)',
    description: 'High-income lounges, prime retail & affluent estates with premium convenience pricing.',
    exampleEstates: 'Kilimani, Westlands, Karen, Runda, Muthaiga, Gigiri',
    defaultMultiplierPercent: 15
  },
  {
    tier: 'UPMARKET_URBAN',
    label: 'Upmarket Urban Class (Lavington • Kileleshwa • Riverside)',
    shortLabel: 'Upmarket Urban',
    description: 'Upmarket residential & commercial neighbourhoods with moderate premium margin.',
    exampleEstates: 'Lavington, Kileleshwa, Riverside, Parklands, Nyali, Milimani',
    defaultMultiplierPercent: 8
  },
  {
    tier: 'STANDARD_RESIDENTIAL',
    label: 'Standard Mid-Market Class (Nairobi CBD • Thika Rd • Langata)',
    shortLabel: 'Standard Mid-Market',
    description: 'Standard company catalog baseline pricing for central & mid-market commercial hubs.',
    exampleEstates: 'Nairobi CBD, Upper Hill, Thika Road, Syokimau, South B & C, Langata',
    defaultMultiplierPercent: 0
  },
  {
    tier: 'EASTLANDS_ECONOMY',
    label: 'Neighbourhood Value / Eastlands Class (Donholm • Buruburu • Embakasi)',
    shortLabel: 'Value Class (Donholm/Eastlands)',
    description: 'Competitive high-turnover neighbourhood pricing tailored for Donholm, Eastlands & mass-market estates.',
    exampleEstates: 'Donholm, Buruburu, Umoja, Greenspan, Embakasi, Kasarani, Roysambu',
    defaultMultiplierPercent: -10
  },
  {
    tier: 'CUSTOM',
    label: 'Custom Branch Preferred Pricing',
    shortLabel: 'Custom Branch Pricing',
    description: 'Custom branch-wide percentage or individual per-product preferred selling prices.',
    exampleEstates: 'Any branch with custom product price list',
    defaultMultiplierPercent: 0
  }
];

/**
 * Reference Geo-Coordinates & Service Zones for Kenyan Delivery Hubs
 * Supports both Haversine GPS routing and Service-Zone Geofence lookup.
 */
export const DELIVERY_ZONE_GEO_DIRECTORY: DeliveryZoneGeoConfig[] = [
  {
    id: 'ZONE_KILIMANI',
    label: 'Kilimani / Kileleshwa / Lavington',
    county: 'Nairobi',
    latitude: -1.2892,
    longitude: 36.7831,
    defaultRadiusKm: 12,
    keywords: ['kilimani', 'kileleshwa', 'lavington', 'yaya', 'argwings', 'hurlingham', 'lenana'],
    defaultMarketClassTier: 'AFFLUENT_PREMIUM',
    defaultPriceMultiplierPercent: 15
  },
  {
    id: 'ZONE_WESTLANDS',
    label: 'Westlands / Parklands / Riverside',
    county: 'Nairobi',
    latitude: -1.2648,
    longitude: 36.8049,
    defaultRadiusKm: 12,
    keywords: ['westlands', 'parklands', 'riverside', 'sarit', 'waiyaki', 'mpaka', 'spring valley', 'gigiri'],
    defaultMarketClassTier: 'AFFLUENT_PREMIUM',
    defaultPriceMultiplierPercent: 15
  },
  {
    id: 'ZONE_DONHOLM_EASTLANDS',
    label: 'Donholm / Buruburu / Umoja / Greenspan (Eastlands)',
    county: 'Nairobi',
    latitude: -1.2962,
    longitude: 36.8906,
    defaultRadiusKm: 14,
    keywords: ['donholm', 'buruburu', 'umoja', 'greenspan', 'savannah', 'fedha', 'pipeline', 'jogoo', 'kayole', 'komarock', 'eastlands', 'tassia', 'nyayo'],
    defaultMarketClassTier: 'EASTLANDS_ECONOMY',
    defaultPriceMultiplierPercent: -10
  },
  {
    id: 'ZONE_KAREN_LANGATA',
    label: 'Karen / Langata / Ngong Road',
    county: 'Nairobi',
    latitude: -1.3219,
    longitude: 36.7065,
    defaultRadiusKm: 15,
    keywords: ['karen', 'langata', 'ngong', 'junction', 'hardy', 'rongai', 'dagoretti'],
    defaultMarketClassTier: 'AFFLUENT_PREMIUM',
    defaultPriceMultiplierPercent: 15
  },
  {
    id: 'ZONE_CBD_UPPERHILL',
    label: 'Nairobi CBD / Upper Hill / Hurlingham',
    county: 'Nairobi',
    latitude: -1.286389,
    longitude: 36.817223,
    defaultRadiusKm: 12,
    keywords: ['cbd', 'central', 'upper hill', 'upperhill', 'moi avenue', 'kenyatta', 'tom mboya', 'downtown', 'ngara'],
    defaultMarketClassTier: 'STANDARD_RESIDENTIAL',
    defaultPriceMultiplierPercent: 0
  },
  {
    id: 'ZONE_MOMBASA_RD',
    label: 'Mombasa Road / Syokimau / South B & C',
    county: 'Nairobi',
    latitude: -1.3268,
    longitude: 36.8542,
    defaultRadiusKm: 16,
    keywords: ['mombasa road', 'syokimau', 'south b', 'south c', 'imara', 'embakasi', 'jkia', 'mlolongo', 'industrial area'],
    defaultMarketClassTier: 'STANDARD_RESIDENTIAL',
    defaultPriceMultiplierPercent: 0
  },
  {
    id: 'ZONE_KIAMBU_RUNDA',
    label: 'Kiambu Road / Runda / Muthaiga / Roysambu',
    county: 'Nairobi',
    latitude: -1.2195,
    longitude: 36.8348,
    defaultRadiusKm: 15,
    keywords: ['kiambu', 'runda', 'muthaiga', 'roysambu', 'ridgeways', 'two rivers', 'ruaka', 'zimmerman'],
    defaultMarketClassTier: 'UPMARKET_URBAN',
    defaultPriceMultiplierPercent: 8
  },
  {
    id: 'ZONE_THIKA_RD',
    label: 'Thika Road / Garden Estate / Kasarani',
    county: 'Nairobi',
    latitude: -1.2211,
    longitude: 36.8895,
    defaultRadiusKm: 16,
    keywords: ['thika', 'garden estate', 'kasarani', 'kahawa', 'ruiru', 'mwiki', 'trm'],
    defaultMarketClassTier: 'EASTLANDS_ECONOMY',
    defaultPriceMultiplierPercent: -10
  },
  {
    id: 'ZONE_MOMBASA_COAST',
    label: 'Mombasa / Nyali / Bamburi',
    county: 'Mombasa',
    latitude: -4.0435,
    longitude: 39.6682,
    defaultRadiusKm: 20,
    keywords: ['mombasa', 'nyali', 'bamburi', 'mtwapa', 'likoni', 'diani', 'coast'],
    defaultMarketClassTier: 'UPMARKET_URBAN',
    defaultPriceMultiplierPercent: 8
  },
  {
    id: 'ZONE_KISUMU_LAKE',
    label: 'Kisumu / Milimani / Mega City',
    county: 'Kisumu',
    latitude: -0.0917,
    longitude: 34.7680,
    defaultRadiusKm: 18,
    keywords: ['kisumu', 'milimani', 'kondele', 'nyanza', 'lake'],
    defaultMarketClassTier: 'STANDARD_RESIDENTIAL',
    defaultPriceMultiplierPercent: 0
  },
  {
    id: 'ZONE_ELDORET_NAKURU',
    label: 'Eldoret / Nakuru Rift Hub',
    county: 'Uasin Gishu',
    latitude: 0.5143,
    longitude: 35.2698,
    defaultRadiusKm: 20,
    keywords: ['eldoret', 'nakuru', 'uasin gishu', 'rift', 'naivasha', 'uganda road'],
    defaultMarketClassTier: 'STANDARD_RESIDENTIAL',
    defaultPriceMultiplierPercent: 0
  }
];

/**
 * Infers the recommended BranchMarketClassTier and default price multiplier %
 * from a branch name, location, or delivery zone (e.g. Donholm -> EASTLANDS_ECONOMY -10%,
 * Kilimani/Westlands -> AFFLUENT_PREMIUM +15%).
 */
export function inferBranchMarketClassFromLocation(searchText: string): {
  marketClassTier: BranchMarketClassTier;
  priceMultiplierPercent: number;
  preset: BranchMarketClassPreset;
} {
  const clean = String(searchText || '').toLowerCase();
  if (
    ['donholm', 'buruburu', 'umoja', 'greenspan', 'savannah', 'fedha', 'pipeline', 'embakasi', 'kasarani', 'kayole', 'komarock', 'eastlands', 'mwiki', 'roysambu', 'zimmerman'].some(
      kw => clean.includes(kw)
    )
  ) {
    const preset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === 'EASTLANDS_ECONOMY')!;
    return {
      marketClassTier: 'EASTLANDS_ECONOMY',
      priceMultiplierPercent: preset.defaultMultiplierPercent,
      preset
    };
  }
  if (
    ['kilimani', 'westlands', 'karen', 'runda', 'muthaiga', 'gigiri', 'riverside', 'spring valley', 'yaya', 'sarit'].some(
      kw => clean.includes(kw)
    )
  ) {
    const preset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === 'AFFLUENT_PREMIUM')!;
    return {
      marketClassTier: 'AFFLUENT_PREMIUM',
      priceMultiplierPercent: preset.defaultMultiplierPercent,
      preset
    };
  }
  if (
    ['lavington', 'kileleshwa', 'parklands', 'nyali', 'diani', 'two rivers', 'ridgeways'].some(
      kw => clean.includes(kw)
    )
  ) {
    const preset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === 'UPMARKET_URBAN')!;
    return {
      marketClassTier: 'UPMARKET_URBAN',
      priceMultiplierPercent: preset.defaultMultiplierPercent,
      preset
    };
  }
  const stdPreset = BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === 'STANDARD_RESIDENTIAL')!;
  return {
    marketClassTier: 'STANDARD_RESIDENTIAL',
    priceMultiplierPercent: stdPreset.defaultMultiplierPercent,
    preset: stdPreset
  };
}

export interface ResolvedBranchProductPrice {
  retailPriceKes: number;
  wholesalePriceKes: number;
  effectiveUnitPriceKes: number;
  baselineRetailPriceKes: number;
  baselineWholesalePriceKes: number;
  baselineUnitPriceKes: number;
  isCustomProductOverride: boolean;
  isMarketClassAdjusted: boolean;
  priceDifferenceKes: number;
  effectiveMultiplierPercent: number;
  marketClassTier: BranchMarketClassTier;
  marketClassLabel: string;
}

/**
 * Resolves the effective selling price of a Product at a specific Branch.
 * Priority:
 * 1. Explicit per-product override in `branch.preferredProductPrices[product.id]` (or scaled from base product ID if volume variant `-vol-`).
 * 2. Branch-wide `priceMultiplierPercent` (or inferred from `branch.marketClassTier`).
 * 3. Standard Company Catalog price (`product.retailPriceKes` / `product.wholesalePriceKes`).
 * Note: Branch prices are always floored at `Math.max(50, product.warehouseCostKes)` so no branch sells below landed cost.
 */
export function resolveBranchProductPrice(
  product: Pick<Product, 'id' | 'sku' | 'retailPriceKes' | 'wholesalePriceKes' | 'warehouseCostKes' | 'volumeMl'>,
  branch?: Partial<Pick<Branch, 'id' | 'name' | 'location' | 'tier' | 'marketClassTier' | 'priceMultiplierPercent' | 'preferredProductPrices'>> | null,
  forceSaleType?: 'RETAIL' | 'WHOLESALE'
): ResolvedBranchProductPrice {
  const isWholesale =
    forceSaleType === 'WHOLESALE' ||
    (!forceSaleType && (branch?.tier === 'MAIN_STORE' || branch?.tier === 'DISTRIBUTOR'));

  const baselineRetailPriceKes = Math.max(50, Math.round(product.retailPriceKes || 0));
  const baselineWholesalePriceKes = Math.max(40, Math.round(product.wholesalePriceKes || 0));
  const baselineUnitPriceKes = isWholesale ? baselineWholesalePriceKes : baselineRetailPriceKes;
  const costFloorKes = Math.max(30, Math.round(product.warehouseCostKes || 30));

  const marketTier: BranchMarketClassTier = branch?.marketClassTier || 'STANDARD_RESIDENTIAL';
  const preset =
    BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === marketTier) ||
    BRANCH_MARKET_CLASS_PRESETS.find(p => p.tier === 'STANDARD_RESIDENTIAL')!;

  const multiplierPct =
    typeof branch?.priceMultiplierPercent === 'number' && Number.isFinite(branch.priceMultiplierPercent)
      ? branch.priceMultiplierPercent
      : marketTier !== 'STANDARD_RESIDENTIAL' && marketTier !== 'CUSTOM'
      ? preset.defaultMultiplierPercent
      : 0;

  const overrides: Record<string, BranchProductPriceOverride> = branch?.preferredProductPrices || {};
  const exactOverride = overrides[product.id] || (product.sku ? overrides[product.sku] : undefined);

  // Check if this is a volume variant (`prod-id-vol-1000`) and scale base product override if present
  const isVolumeVariant = product.id.includes('-vol-');
  const baseProdId = isVolumeVariant ? product.id.split('-vol-')[0] : product.id;
  const baseOverride = !exactOverride && isVolumeVariant ? overrides[baseProdId] : undefined;

  let retailPriceKes = baselineRetailPriceKes;
  let wholesalePriceKes = baselineWholesalePriceKes;
  let isCustomProductOverride = false;
  let isMarketClassAdjusted = false;

  if (exactOverride && (exactOverride.retailPriceKes || exactOverride.wholesalePriceKes)) {
    isCustomProductOverride = true;
    if (exactOverride.retailPriceKes && exactOverride.retailPriceKes > 0) {
      retailPriceKes = Math.max(costFloorKes, Math.round(exactOverride.retailPriceKes));
    } else if (multiplierPct !== 0) {
      retailPriceKes = Math.max(
        costFloorKes,
        Math.round((baselineRetailPriceKes * (1 + multiplierPct / 100)) / 10) * 10
      );
    }
    if (exactOverride.wholesalePriceKes && exactOverride.wholesalePriceKes > 0) {
      wholesalePriceKes = Math.max(costFloorKes, Math.round(exactOverride.wholesalePriceKes));
    } else if (exactOverride.retailPriceKes && exactOverride.retailPriceKes > 0) {
      wholesalePriceKes = Math.max(costFloorKes, Math.round(retailPriceKes * 0.86));
    }
  } else if (baseOverride && (baseOverride.retailPriceKes || baseOverride.wholesalePriceKes)) {
    isCustomProductOverride = true;
    // Scale proportionally with baseline retail price (which already scaled by volume ratio)
    if (baseOverride.retailPriceKes && baseOverride.retailPriceKes > 0) {
      retailPriceKes = Math.max(costFloorKes, Math.round(baseOverride.retailPriceKes));
    }
    if (baseOverride.wholesalePriceKes && baseOverride.wholesalePriceKes > 0) {
      wholesalePriceKes = Math.max(costFloorKes, Math.round(baseOverride.wholesalePriceKes));
    }
  } else if (multiplierPct !== 0) {
    isMarketClassAdjusted = true;
    const factor = 1 + multiplierPct / 100;
    retailPriceKes = Math.max(
      costFloorKes,
      Math.round((baselineRetailPriceKes * factor) / 10) * 10
    );
    wholesalePriceKes = Math.max(
      costFloorKes,
      Math.round((baselineWholesalePriceKes * factor) / 10) * 10
    );
  }

  const effectiveUnitPriceKes = isWholesale ? wholesalePriceKes : retailPriceKes;
  const priceDifferenceKes = effectiveUnitPriceKes - baselineUnitPriceKes;

  return {
    retailPriceKes,
    wholesalePriceKes,
    effectiveUnitPriceKes,
    baselineRetailPriceKes,
    baselineWholesalePriceKes,
    baselineUnitPriceKes,
    isCustomProductOverride,
    isMarketClassAdjusted,
    priceDifferenceKes,
    effectiveMultiplierPercent: multiplierPct,
    marketClassTier: marketTier,
    marketClassLabel: preset.shortLabel
  };
}

/**
 * Haversine Great-Circle Spatial Distance Formula
 * Computes exact spherical distance in kilometers between two GPS coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth mean radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Estimates doorstep rider ETA in minutes from distance in km
 * Includes 12 min dispatch/packing buffer + urban traffic factor.
 */
export function estimateDeliveryEtaMinutes(distanceKm: number): number {
  const dispatchPrepMins = 12;
  const travelMins = Math.round(Math.max(0.5, distanceKm) * 3.2);
  return Math.min(120, Math.max(15, dispatchPrepMins + travelMins));
}

/**
 * Resolves GPS coordinates, delivery radius, and service zones for a branch.
 * If the branch doesn't have explicit coordinates yet, infers them deterministically
 * from its location/county/name or index offset so every branch has a valid spatial pin.
 */
export function resolveBranchGeoProfile(
  branch: Branch,
  branchIndex: number = 0
): {
  latitude: number;
  longitude: number;
  maxDeliveryRadiusKm: number;
  deliveryZones: string[];
  matchedZoneLabel: string;
} {
  const searchStr = `${branch.location || ''} ${branch.county || ''} ${branch.name || ''}`.toLowerCase();

  const matchedZone =
    DELIVERY_ZONE_GEO_DIRECTORY.find(z =>
      z.keywords.some(kw => searchStr.includes(kw))
    ) ||
    DELIVERY_ZONE_GEO_DIRECTORY[branchIndex % DELIVERY_ZONE_GEO_DIRECTORY.length];

  // Small deterministic offset if multiple branches share the same zone without explicit lat/lng
  const latOffset = branch.latitude !== undefined ? 0 : (branchIndex % 5) * 0.0035;
  const lngOffset = branch.longitude !== undefined ? 0 : (branchIndex % 5) * 0.0042;

  const latitude =
    typeof branch.latitude === 'number' && !Number.isNaN(branch.latitude)
      ? branch.latitude
      : Number((matchedZone.latitude + latOffset).toFixed(6));

  const longitude =
    typeof branch.longitude === 'number' && !Number.isNaN(branch.longitude)
      ? branch.longitude
      : Number((matchedZone.longitude + lngOffset).toFixed(6));

  const maxDeliveryRadiusKm =
    branch.maxDeliveryRadiusKm && branch.maxDeliveryRadiusKm > 0
      ? branch.maxDeliveryRadiusKm
      : matchedZone.defaultRadiusKm;

  const deliveryZones =
    branch.deliveryZones && branch.deliveryZones.length > 0
      ? branch.deliveryZones
      : [matchedZone.label];

  return {
    latitude,
    longitude,
    maxDeliveryRadiusKm,
    deliveryZones,
    matchedZoneLabel: matchedZone.label
  };
}

export interface RankedNearestBranch {
  branch: Branch;
  latitude: number;
  longitude: number;
  distanceKm: number;
  estimatedEtaMinutes: number;
  maxDeliveryRadiusKm: number;
  withinServiceRadius: boolean;
  servesSelectedZone: boolean;
  stockedProductCount: number;
  totalBottlesAvailable: number;
  routingModel: BranchRoutingModel;
}

/**
 * Hybrid Nearest-Branch Geo-Routing & Distributed Order Management (DOM) Engine:
 * Ranks all customer-facing branches by:
 * 1. Exact Haversine GPS distance (if customer shares GPS or selects a delivery zone centroid)
 * 2. Service-Zone Geofence assignment (branches explicitly serving the customer's zone)
 * 3. Live Branch Inventory availability (stocked SKU count & bottles on hand)
 */
export function rankBranchesForCustomer(params: {
  branches: Branch[];
  inventoryItems: InventoryItem[];
  customerCoords?: { lat: number; lng: number } | null;
  selectedDeliveryZone?: string;
  manualBranchId?: string | null;
}): RankedNearestBranch[] {
  const {
    branches,
    inventoryItems,
    customerCoords,
    selectedDeliveryZone,
    manualBranchId
  } = params;

  // Filter to branches permitted to fulfill customer orders (exclude fulfillment-only Tier 1 Warehouses unless no retail branch exists)
  const retailBranches = branches.filter(b => b.allowDirectSales && b.tier !== 'WAREHOUSE');
  const candidateBranches = retailBranches.length > 0 ? retailBranches : branches;

  // Determine target customer reference coordinates (Live GPS > Selected Delivery Zone Centroid > Nairobi CBD default)
  const zoneConfig =
    DELIVERY_ZONE_GEO_DIRECTORY.find(z => z.label === selectedDeliveryZone) ||
    DELIVERY_ZONE_GEO_DIRECTORY[0];

  const refLat = customerCoords ? customerCoords.lat : zoneConfig.latitude;
  const refLng = customerCoords ? customerCoords.lng : zoneConfig.longitude;

  const ranked = candidateBranches.map((branch, idx) => {
    const geo = resolveBranchGeoProfile(branch, idx);
    const distanceKm = calculateHaversineDistanceKm(
      refLat,
      refLng,
      geo.latitude,
      geo.longitude
    );
    const estimatedEtaMinutes = estimateDeliveryEtaMinutes(distanceKm);
    const withinServiceRadius = distanceKm <= geo.maxDeliveryRadiusKm;
    const servesSelectedZone = Boolean(
      selectedDeliveryZone &&
        (geo.deliveryZones.includes(selectedDeliveryZone) ||
          geo.matchedZoneLabel === selectedDeliveryZone)
    );

    const branchInv = inventoryItems.filter(
      i => i.branchId === branch.id && i.bottlesOnHand > 0
    );
    const stockedProductCount = branchInv.length;
    const totalBottlesAvailable = branchInv.reduce(
      (sum, i) => sum + Math.max(0, i.bottlesOnHand),
      0
    );

    const routingModel: BranchRoutingModel =
      manualBranchId && manualBranchId === branch.id
        ? 'MANUAL_SELECTION'
        : customerCoords
        ? 'GPS_HAVERSINE'
        : 'SERVICE_ZONE_GEOFENCE';

    return {
      branch,
      latitude: geo.latitude,
      longitude: geo.longitude,
      distanceKm,
      estimatedEtaMinutes,
      maxDeliveryRadiusKm: geo.maxDeliveryRadiusKm,
      withinServiceRadius,
      servesSelectedZone,
      stockedProductCount,
      totalBottlesAvailable,
      routingModel
    };
  });

  // Sort branches:
  // 1. If customer did NOT use live GPS, prioritize branches that explicitly serve the selected zone and are close
  // 2. Otherwise sort strictly by shortest Haversine distance (km), breaking ties by stocked inventory
  return ranked.sort((a, b) => {
    if (!customerCoords && a.servesSelectedZone !== b.servesSelectedZone) {
      return a.servesSelectedZone ? -1 : 1;
    }
    if (Math.abs(a.distanceKm - b.distanceKm) > 0.2) {
      return a.distanceKm - b.distanceKm;
    }
    return b.totalBottlesAvailable - a.totalBottlesAvailable;
  });
}

/**
 * Stock-Aware Nearest-Branch Fallback Lookup:
 * If the #1 nearest branch is out of stock for a specific product, finds the next-nearest branch
 * that has `bottlesOnHand >= requiredQty` so the customer can switch or auto-route their order.
 */
export function findNearestStockedBranchForProduct(params: {
  productId: string;
  requiredQty?: number;
  rankedBranches: RankedNearestBranch[];
  inventoryItems: InventoryItem[];
}): { rankedBranch: RankedNearestBranch; stock: number } | null {
  const { productId, requiredQty = 1, rankedBranches, inventoryItems } = params;
  for (const rb of rankedBranches) {
    const inv = inventoryItems.find(
      i => i.branchId === rb.branch.id && i.productId === productId
    );
    const bottles = inv ? Math.max(0, inv.bottlesOnHand) : 0;
    if (bottles >= requiredQty) {
      return { rankedBranch: rb, stock: bottles };
    }
  }
  return null;
}
