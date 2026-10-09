import React, { useState, useEffect } from 'react';
import { StockCategory } from '../../types';
import {
  getProductImageUrl,
  generateStudioBottleSvgDataUri,
  extractGoogleDriveFileId
} from '../../utils/productImages';

export interface ProductImageProps {
  product: {
    id?: string;
    name?: string;
    brand?: string;
    subCategory?: string;
    volumeMl?: number;
    alcoholPercentage?: number;
    category?: StockCategory;
    image?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showVolumeBadge?: boolean;
  onClick?: () => void;
}

const SIZE_CLASSES: Record<NonNullable<ProductImageProps['size']>, string> = {
  xs: 'w-9 h-9 rounded-lg',
  sm: 'w-12 h-12 rounded-xl',
  md: 'w-16 h-16 rounded-xl',
  lg: 'w-24 h-24 rounded-2xl',
  xl: 'w-32 h-32 rounded-2xl',
  full: 'w-full h-full rounded-xl'
};

export const ProductImage: React.FC<ProductImageProps> = React.memo(({
  product,
  size = 'md',
  className = '',
  showVolumeBadge = false,
  onClick
}) => {
  const primarySrc = getProductImageUrl(product);
  const [imgSrc, setImgSrc] = useState<string>(primarySrc);
  const [usedFallback, setUsedFallback] = useState<boolean>(false);

  useEffect(() => {
    setImgSrc(getProductImageUrl(product));
    setUsedFallback(false);
  }, [product.image, product.name, product.brand, product.subCategory, product.category]);

  return (
    <div
      onClick={onClick}
      className={`relative shrink-0 overflow-hidden bg-slate-900 border border-slate-200/90 shadow-2xs select-none group/img ${SIZE_CLASSES[size]} ${
        onClick ? 'cursor-pointer hover:ring-2 hover:ring-[#0A006E] transition-all' : ''
      } ${className}`}
      title={onClick ? `Click to view or update image for ${product.name || 'Product'}` : product.name}
    >
      <img
        src={imgSrc}
        alt={product.name || 'Beverage Product'}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          const driveId = extractGoogleDriveFileId(product.image || imgSrc);
          if (driveId && !imgSrc.includes('lh3.googleusercontent.com')) {
            setImgSrc(`https://lh3.googleusercontent.com/d/${driveId}=w420`);
            return;
          }
          if (!usedFallback) {
            setUsedFallback(true);
            setImgSrc(generateStudioBottleSvgDataUri(product));
          }
        }}
        className="w-full h-full object-cover object-center block transition-transform duration-200 group-hover/img:scale-105"
      />

      {/* Subtle brand/volume corner indicator for larger thumbnails */}
      {showVolumeBadge && product.volumeMl && (
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[9px] font-mono font-bold text-[#FFDE00] leading-none shadow-xs">
          {product.volumeMl >= 1000 ? `${product.volumeMl / 1000}L` : `${product.volumeMl}ml`}
        </span>
      )}
    </div>
  );
}, (prev, next) => (
  prev.size === next.size &&
  prev.className === next.className &&
  prev.showVolumeBadge === next.showVolumeBadge &&
  prev.product.id === next.product.id &&
  prev.product.image === next.product.image &&
  prev.product.name === next.product.name &&
  prev.product.brand === next.product.brand &&
  prev.product.subCategory === next.product.subCategory &&
  prev.product.category === next.product.category &&
  prev.product.volumeMl === next.product.volumeMl
));
