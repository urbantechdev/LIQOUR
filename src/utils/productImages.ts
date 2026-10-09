import { Product, StockCategory } from '../types';

const whiskyImg = new URL('../assets/images/product_whisky_scotch_1790446242615.jpg', import.meta.url).href;
const cognacBrandyImg = new URL('../assets/images/product_cognac_brandy_1790446252743.jpg', import.meta.url).href;
const ginVodkaImg = new URL('../assets/images/product_gin_vodka_1790446262612.jpg', import.meta.url).href;
const champagneWineImg = new URL('../assets/images/product_champagne_wine_1790446272934.jpg', import.meta.url).href;
const beerCiderImg = new URL('../assets/images/product_beer_cider_1790446283876.jpg', import.meta.url).href;

export const STUDIO_PRODUCT_IMAGES = {
  WHISKY: whiskyImg,
  COGNAC_BRANDY: cognacBrandyImg,
  GIN_VODKA: ginVodkaImg,
  CHAMPAGNE_WINE: champagneWineImg,
  BEER_CIDER: beerCiderImg
} as const;

export interface StudioImagePreset {
  id: string;
  label: string;
  subCategory: string;
  url: string;
}

export const STUDIO_IMAGE_PRESETS: StudioImagePreset[] = [
  {
    id: 'preset-whisky',
    label: 'Scotch & Single Malt Whisky',
    subCategory: 'Whisky',
    url: STUDIO_PRODUCT_IMAGES.WHISKY
  },
  {
    id: 'preset-cognac',
    label: 'French Cognac & Brandy',
    subCategory: 'Cognac & Brandy',
    url: STUDIO_PRODUCT_IMAGES.COGNAC_BRANDY
  },
  {
    id: 'preset-gin-vodka',
    label: 'London Dry Gin, Vodka & White Spirits',
    subCategory: 'Gin',
    url: STUDIO_PRODUCT_IMAGES.GIN_VODKA
  },
  {
    id: 'preset-champagne-wine',
    label: 'Champagne, Wine & Cream Liqueurs',
    subCategory: 'Champagne & Wine',
    url: STUDIO_PRODUCT_IMAGES.CHAMPAGNE_WINE
  },
  {
    id: 'preset-beer-cider',
    label: 'Chilled Lager Cans & Craft Cider',
    subCategory: 'Beer & Cider',
    url: STUDIO_PRODUCT_IMAGES.BEER_CIDER
  }
];

/**
 * Extracts a Google Drive file ID from common Google Drive share/view/open/uc URLs.
 */
export function extractGoogleDriveFileId(rawUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed.includes('drive.google.com') && !trimmed.includes('docs.google.com')) {
    return null;
  }

  // Match /file/d/{FILE_ID} or /d/{FILE_ID}
  const pathMatch = trimmed.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]{10,})/);
  if (pathMatch && pathMatch[1]) {
    return pathMatch[1];
  }

  // Match ?id={FILE_ID} or &id={FILE_ID}
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryMatch && queryMatch[1]) {
    return queryMatch[1];
  }

  return null;
}

/**
 * Normalizes any image URL or Google Drive share link into a direct renderable image src.
 */
export function normalizeProductImageUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  // Keep data: URIs and local assets untouched
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  const driveFileId = extractGoogleDriveFileId(trimmed);
  if (driveFileId) {
    return `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w420`;
  }

  // Automatically cap external Unsplash URLs to lightweight 420px WebP/AVIF format
  if (trimmed.includes('images.unsplash.com')) {
    try {
      const urlObj = new URL(trimmed);
      urlObj.searchParams.set('w', '420');
      urlObj.searchParams.set('q', '74');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

/**
 * Reads an uploaded image File from local drive / device and compresses it to a lightweight Data URL
 * (~15KB-30KB WebP/JPEG) so it loads instantly and persists reliably in localStorage & Firestore.
 */
export function compressImageFileToDataUrl(file: File, maxDimension = 420): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!rawDataUrl) {
        reject(new Error('Empty image file'));
        return;
      }

      // If SVG or already ultra-lite file (< 35KB), return directly
      if (file.type === 'image/svg+xml' || file.size < 35 * 1024) {
        resolve(rawDataUrl);
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width >= height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const webpCompressed = canvas.toDataURL('image/webp', 0.74);
          if (webpCompressed.startsWith('data:image/webp')) {
            resolve(webpCompressed);
            return;
          }
          const jpegCompressed = canvas.toDataURL('image/jpeg', 0.74);
          resolve(jpegCompressed);
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

const resolvedImageUrlCache = new Map<string, string>();
const resolvedSvgDataUriCache = new Map<string, string>();

/**
 * Resolves the appropriate studio photography asset for a product based on its
 * explicit image property, subcategory, or product name/brand keywords.
 */
export function getProductImageUrl(product: {
  image?: string;
  name?: string;
  brand?: string;
  subCategory?: string;
  category?: StockCategory;
}): string {
  if (product.image && product.image.trim().length > 0) {
    return normalizeProductImageUrl(product.image);
  }

  const cacheKey = `${product.subCategory || ''}|${product.brand || ''}|${product.name || ''}`;
  const cached = resolvedImageUrlCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const sub = (product.subCategory || '').toLowerCase();
  const text = `${product.name || ''} ${product.brand || ''} ${sub}`.toLowerCase();

  const cacheAndReturn = (url: string): string => {
    if (resolvedImageUrlCache.size > 2000) {
      resolvedImageUrlCache.clear();
    }
    resolvedImageUrlCache.set(cacheKey, url);
    return url;
  };

  if (sub === 'whisky') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.WHISKY);
  }
  if (sub === 'white rum') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.GIN_VODKA);
  }
  if (sub === 'spiced & dark rum') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.COGNAC_BRANDY);
  }
  if (sub === 'gin' || sub === 'vodka' || sub === 'tequila') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.GIN_VODKA);
  }
  if (sub === 'rum') {
    if (
      text.includes('carta blanca') ||
      text.includes('white rum') ||
      text.includes('white spiced') ||
      text.includes('3 years cuban white') ||
      (text.includes('malibu') && !text.includes('malibu black'))
    ) {
      return cacheAndReturn(STUDIO_PRODUCT_IMAGES.GIN_VODKA);
    }
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.COGNAC_BRANDY);
  }
  if (sub === 'cognac & brandy') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.COGNAC_BRANDY);
  }
  if (sub === 'champagne & wine' || sub === 'liqueur & cream' || sub === 'cream liqueur') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.CHAMPAGNE_WINE);
  }
  if (sub === 'beer & cider') {
    return cacheAndReturn(STUDIO_PRODUCT_IMAGES.BEER_CIDER);
  }

  if (
    sub.includes('beer') ||
    sub.includes('cider') ||
    text.includes('tusker') ||
    text.includes('savanna') ||
    text.includes('pineapple punch') ||
    text.includes('smirnoff ice') ||
    text.includes('can') ||
    text.includes('guinness') ||
    text.includes('heineken') ||
    text.includes('white cap') ||
    text.includes('balozi') ||
    text.includes('pilsner') ||
    text.includes('allsopps') ||
    text.includes('summit') ||
    text.includes('manyatta') ||
    text.includes('sikera') ||
    text.includes('snapp') ||
    text.includes('senator') ||
    text.includes('bila shaka') ||
    text.includes('254 brewing') ||
    text.includes('kenyan originals') ||
    text.includes('desperados') ||
    text.includes('tonic')
  ) {
    return STUDIO_PRODUCT_IMAGES.BEER_CIDER;
  }

  if (
    sub.includes('cognac') ||
    sub.includes('brandy') ||
    text.includes('hennessy') ||
    text.includes('martell') ||
    text.includes('richot') ||
    text.includes('viceroy') ||
    text.includes('remy') ||
    text.includes('rémy') ||
    text.includes('courvoisier') ||
    text.includes('three barrels') ||
    text.includes('bardinet') ||
    text.includes('beehive') ||
    text.includes('napoleon') ||
    text.includes('don montego') ||
    text.includes('metaxa') ||
    text.includes('torres') ||
    text.includes('dusse') ||
    text.includes("d'ussé") ||
    text.includes('camus') ||
    text.includes('bisquit') ||
    text.includes('meukow')
  ) {
    return STUDIO_PRODUCT_IMAGES.COGNAC_BRANDY;
  }

  if (
    sub.includes('champagne') ||
    sub.includes('wine') ||
    sub.includes('liqueur') ||
    text.includes('moët') ||
    text.includes('moet') ||
    text.includes('veuve') ||
    text.includes('belaire') ||
    text.includes('mumm') ||
    text.includes('piper-heidsieck') ||
    text.includes('laurent-perrier') ||
    text.includes('taittinger') ||
    text.includes('perrier-jouët') ||
    text.includes('bollinger') ||
    text.includes('ruinart') ||
    text.includes('dom pérignon') ||
    text.includes('armand de brignac') ||
    text.includes('cristal') ||
    text.includes('krug') ||
    text.includes('muscador') ||
    text.includes('zonin') ||
    text.includes('teresa rizzi') ||
    text.includes('4th street') ||
    text.includes('robertson') ||
    text.includes('baileys') ||
    text.includes('amarula') ||
    text.includes('jagermeister') ||
    text.includes('jägermeister') ||
    text.includes('tia maria') ||
    text.includes('limoncello')
  ) {
    return STUDIO_PRODUCT_IMAGES.CHAMPAGNE_WINE;
  }

  if (
    sub.includes('gin') ||
    sub.includes('vodka') ||
    sub.includes('rum') ||
    sub.includes('tequila') ||
    text.includes('tanqueray') ||
    text.includes('gordon') ||
    text.includes('hendrick') ||
    text.includes('bombay') ||
    text.includes('gilbey') ||
    text.includes('chrome') ||
    text.includes('kibao') ||
    text.includes('triple ace') ||
    text.includes('flirt') ||
    text.includes('skyy') ||
    text.includes('magic moments') ||
    text.includes('absolut') ||
    text.includes('stolichnaya') ||
    text.includes('russian standard') ||
    text.includes('ketel') ||
    text.includes('tito') ||
    text.includes('ciroc') ||
    text.includes('cîroc') ||
    text.includes('grey goose') ||
    text.includes('belvedere') ||
    text.includes('beluga') ||
    text.includes('smirnoff') ||
    text.includes('captain morgan') ||
    text.includes('malibu') ||
    text.includes('olmeca') ||
    text.includes('cuervo') ||
    text.includes('camino real') ||
    text.includes('sierra') ||
    text.includes('don julio') ||
    text.includes('patron') ||
    text.includes('patrón') ||
    text.includes('casamigos') ||
    text.includes('clase azul') ||
    text.includes('espolon')
  ) {
    return STUDIO_PRODUCT_IMAGES.GIN_VODKA;
  }

  return cacheAndReturn(STUDIO_PRODUCT_IMAGES.WHISKY);
}

/**
 * Generates a high-contrast studio bottle/can SVG data URI for custom products or fallback display.
 */
export function generateStudioBottleSvgDataUri(product: {
  name?: string;
  brand?: string;
  subCategory?: string;
  volumeMl?: number;
  alcoholPercentage?: number;
  category?: StockCategory;
}): string {
  const svgCacheKey = `${product.brand || ''}|${product.name || ''}|${product.subCategory || ''}|${product.volumeMl || ''}|${product.alcoholPercentage || ''}`;
  const cachedSvg = resolvedSvgDataUriCache.get(svgCacheKey);
  if (cachedSvg) {
    return cachedSvg;
  }

  const name = product.name || 'Premium Beverage';
  const brand = (product.brand || name.split(' ')[0] || 'VAAIRO').toUpperCase().slice(0, 14);
  const sub = (product.subCategory || 'Spirit').toUpperCase().slice(0, 16);
  const vol = product.volumeMl ? `${product.volumeMl}ML` : '750ML';
  const abv = product.alcoholPercentage ? `${product.alcoholPercentage}% ABV` : '40% ABV';

  const lower = `${name} ${brand} ${sub}`.toLowerCase();

  let bgStart = '#1E293B';
  let bgEnd = '#0F172A';
  let bottleFill = '#92400E';
  let labelBg = '#111827';
  let labelAccent = '#FACC15';
  let labelText = '#FFFFFF';

  if (lower.includes('red label') || lower.includes('smirnoff') || lower.includes('4th street') || lower.includes('robertson')) {
    bottleFill = '#7F1D1D';
    labelBg = '#991B1B';
    labelAccent = '#FDE047';
  } else if (lower.includes('gold') || lower.includes('tusker') || lower.includes('veuve') || lower.includes('moët') || lower.includes('moet')) {
    bottleFill = '#B45309';
    labelBg = '#78350F';
    labelAccent = '#FDE047';
  } else if (lower.includes('jameson') || lower.includes('tanqueray') || lower.includes('glenfiddich') || lower.includes('jager') || lower.includes('jäger')) {
    bottleFill = '#065F46';
    labelBg = '#FEF3C7';
    labelAccent = '#065F46';
    labelText = '#064E3B';
  } else if (lower.includes('bombay') || lower.includes('absolut') || lower.includes('ciroc') || lower.includes('cîroc')) {
    bottleFill = '#0284C7';
    labelBg = '#F8FAFC';
    labelAccent = '#0369A1';
    labelText = '#0F172A';
  } else if (lower.includes('pink')) {
    bottleFill = '#DB2777';
    labelBg = '#FDF2F8';
    labelAccent = '#BE185D';
    labelText = '#831843';
  } else if (lower.includes('hennessy') || lower.includes('martell') || lower.includes('richot')) {
    bottleFill = '#7C2D12';
    labelBg = '#FFFBEB';
    labelAccent = '#B45309';
    labelText = '#451A03';
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240" width="360" height="360" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}" />
        <stop offset="100%" stop-color="${bgEnd}" />
      </linearGradient>
      <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${bottleFill}" stop-opacity="0.9" />
        <stop offset="45%" stop-color="${bottleFill}" stop-opacity="1" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.85" />
      </linearGradient>
    </defs>
    <rect width="240" height="240" fill="url(#bg)" />
    <ellipse cx="120" cy="224" rx="68" ry="10" fill="#000000" opacity="0.45" />
    <!-- Bottle Cap & Neck -->
    <rect x="104" y="12" width="32" height="18" rx="4" fill="${labelAccent}" />
    <rect x="107" y="30" width="26" height="34" fill="url(#glass)" />
    <!-- Bottle Body -->
    <path d="M78,80 C78,66 102,60 107,60 L133,60 C138,60 162,66 162,80 L166,210 C166,218 158,224 148,224 L92,224 C82,224 74,218 74,210 Z" fill="url(#glass)" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />
    <!-- Glass Highlight -->
    <path d="M84,82 L82,206" stroke="rgba(255,255,255,0.35)" stroke-width="3.5" stroke-linecap="round" />
    <!-- Main Label -->
    <rect x="78" y="98" width="84" height="86" rx="5" fill="${labelBg}" stroke="${labelAccent}" stroke-width="2" />
    <text x="120" y="124" text-anchor="middle" font-family="sans-serif" font-weight="900" font-size="11" fill="${labelText}">${brand}</text>
    <line x1="88" y1="133" x2="152" y2="133" stroke="${labelAccent}" stroke-width="1.2" />
    <text x="120" y="150" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="9" fill="${labelText}">${sub}</text>
    <text x="120" y="170" text-anchor="middle" font-family="monospace" font-weight="700" font-size="8.5" fill="${labelText}" opacity="0.9">${vol} • ${abv}</text>
  </svg>`;

  const encoded = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  if (resolvedSvgDataUriCache.size > 1000) {
    resolvedSvgDataUriCache.clear();
  }
  resolvedSvgDataUriCache.set(svgCacheKey, encoded);
  return encoded;
}
