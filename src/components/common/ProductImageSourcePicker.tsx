import React, { useState } from 'react';
import { StockCategory } from '../../types';
import {
  Upload,
  Link2,
  HardDrive,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import {
  STUDIO_IMAGE_PRESETS,
  compressImageFileToDataUrl,
  extractGoogleDriveFileId,
  normalizeProductImageUrl,
  generateStudioBottleSvgDataUri,
  getProductImageUrl
} from '../../utils/productImages';

export interface ProductImageSourcePickerProps {
  value: string;
  onChange: (newImageUrl: string) => void;
  productContext?: {
    name?: string;
    brand?: string;
    subCategory?: string;
    volumeMl?: number;
    alcoholPercentage?: number;
    category?: StockCategory;
  };
  compact?: boolean;
}

export const ProductImageSourcePicker: React.FC<ProductImageSourcePickerProps> = ({
  value,
  onChange,
  productContext,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'DRIVE' | 'LINK' | 'PRESETS'>('DRIVE');
  const [driveLinkInput, setDriveLinkInput] = useState<string>('');
  const [webLinkInput, setWebLinkInput] = useState<string>(
    value && !value.startsWith('data:image/') ? value : ''
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleFileSelected = async (file?: File | null) => {
    if (!file) return;
    try {
      const compressedDataUrl = await compressImageFileToDataUrl(file);
      onChange(compressedDataUrl);
      setStatusMessage(`Loaded "${file.name}" from device drive.`);
    } catch {
      setStatusMessage('Could not read that image file. Please try another photo.');
    }
  };

  const handleApplyGoogleDriveLink = () => {
    const raw = driveLinkInput.trim();
    if (!raw) return;
    const driveId = extractGoogleDriveFileId(raw);
    const normalized = normalizeProductImageUrl(raw);
    onChange(normalized);
    if (driveId) {
      setStatusMessage(`Connected Google Drive image (File ID: ${driveId.slice(0, 10)}...)`);
    } else {
      setStatusMessage('Applied Drive / cloud image link.');
    }
  };

  const handleApplyWebLink = () => {
    const raw = webLinkInput.trim();
    if (!raw) return;
    const normalized = normalizeProductImageUrl(raw);
    onChange(normalized);
    setStatusMessage('Applied direct image link.');
  };

  const previewUrl =
    value ||
    getProductImageUrl({
      name: productContext?.name || 'Spirit Bottle',
      brand: productContext?.brand,
      subCategory: productContext?.subCategory,
      category: productContext?.category
    });

  const detectedDriveId = extractGoogleDriveFileId(driveLinkInput || value);

  return (
    <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5 space-y-3">
      {/* Header & Source Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-xs font-montserrat font-black text-slate-800 flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-[#0A006E]" />
          <span>Product Image (Upload from Drive or Link)</span>
        </label>

        <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('DRIVE')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold inline-flex items-center gap-1 transition ${
              activeTab === 'DRIVE'
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <HardDrive className="w-3 h-3" />
            <span>From Drive</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LINK')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold inline-flex items-center gap-1 transition ${
              activeTab === 'LINK'
                ? 'bg-[#0A006E] text-[#FFDE00]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Link2 className="w-3 h-3" />
            <span>Image Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRESETS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-montserrat font-bold inline-flex items-center gap-1 transition ${
              activeTab === 'PRESETS'
                ? 'bg-[#34D186] text-[#FFDE00]'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            <span>Studio Presets</span>
          </button>
        </div>
      </div>

      {/* Live Thumbnail + Active Tab Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3">
        {/* Live Preview Box */}
        <div
          className={`relative shrink-0 rounded-xl overflow-hidden bg-slate-900 border-2 border-slate-300 shadow-xs mx-auto sm:mx-0 ${
            compact ? 'w-20 h-20' : 'w-24 h-24'
          }`}
        >
          <img
            src={previewUrl}
            alt={productContext?.name || 'Product Preview'}
            referrerPolicy="no-referrer"
            onError={(e) => {
              const fallbackId = extractGoogleDriveFileId(previewUrl);
              const imgEl = e.currentTarget as HTMLImageElement;
              if (fallbackId && !imgEl.src.includes('lh3.googleusercontent.com')) {
                imgEl.src = `https://lh3.googleusercontent.com/d/${fallbackId}=w1000`;
                return;
              }
              imgEl.src = generateStudioBottleSvgDataUri(productContext || {});
            }}
            className="w-full h-full object-cover object-center block"
          />
          <span className="absolute bottom-1 inset-x-1 px-1 py-0.5 rounded bg-black/75 text-[8px] font-mono font-bold text-[#FFDE00] text-center truncate">
            {value.startsWith('data:image/')
              ? 'Local File'
              : extractGoogleDriveFileId(value) || value.includes('drive.google.com')
              ? 'Google Drive'
              : 'Live Preview'}
          </span>
        </div>

        {/* Source Input Panel */}
        <div className="flex-1 min-w-0 space-y-2.5">
          {activeTab === 'DRIVE' && (
            <div className="space-y-2.5">
              {/* 1. Local Device / Computer Drive Upload + Drag & Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) handleFileSelected(droppedFile);
                }}
                className={`p-2.5 rounded-xl border-2 border-dashed transition flex flex-wrap items-center justify-between gap-2 ${
                  isDragging
                    ? 'border-[#0A006E] bg-blue-50/70'
                    : 'border-slate-300 bg-white hover:border-[#0A006E]/60'
                }`}
              >
                <div className="text-[11px] text-slate-600">
                  <div className="font-montserrat font-bold text-slate-900">
                    1. Upload from Device / Computer Drive
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Browse local storage, phone gallery, or drag &amp; drop a photo
                  </div>
                </div>

                <label className="px-3 py-1.5 rounded-xl bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-xs font-montserrat font-bold cursor-pointer inline-flex items-center gap-1.5 shadow-2xs transition shrink-0">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Browse Drive</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* 2. Google Drive Share Link Auto-Converter */}
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-montserrat font-bold text-slate-800">
                    2. Or Paste Google Drive Image Share Link
                  </span>
                  <a
                    href="https://drive.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-montserrat font-bold text-[#0A006E] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open Google Drive</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={driveLinkInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDriveLinkInput(val);
                      if (extractGoogleDriveFileId(val)) {
                        onChange(normalizeProductImageUrl(val));
                      }
                    }}
                    placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                    className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleApplyGoogleDriveLink}
                    className="px-3 py-1.5 rounded-lg bg-[#34D186] hover:bg-emerald-950 text-[#FFDE00] text-xs font-montserrat font-bold shrink-0 transition"
                  >
                    Load Drive Link
                  </button>
                </div>
                {detectedDriveId && (
                  <div className="text-[10px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Google Drive File ID ({detectedDriveId.slice(0, 12)}...) auto-converted to direct image</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'LINK' && (
            <div className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-2">
              <div className="text-[11px] font-montserrat font-bold text-slate-800">
                Paste Direct Image URL / Web Link
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={webLinkInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWebLinkInput(val);
                    if (val.trim().startsWith('http')) {
                      onChange(normalizeProductImageUrl(val));
                    }
                  }}
                  placeholder="https://example.com/bottle-photo.jpg or Google Drive link"
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleApplyWebLink}
                  className="px-3.5 py-2 rounded-lg bg-[#0A006E] hover:bg-[#060046] text-[#FFDE00] text-xs font-montserrat font-bold shrink-0 transition"
                >
                  Apply Link
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Supports direct <code className="font-mono">.jpg</code>, <code className="font-mono">.png</code>, <code className="font-mono">.webp</code> web links, <code className="font-mono">nairobidrinks.co.ke</code> image links, and Google Drive links.
              </p>
            </div>
          )}

          {activeTab === 'PRESETS' && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase">
                Select Studio Bottle Preset
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {STUDIO_IMAGE_PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onChange(preset.url);
                      setStatusMessage(`Selected "${preset.label}" studio preset.`);
                    }}
                    className={`rounded-lg overflow-hidden border-2 h-12 transition ${
                      value === preset.url
                        ? 'border-[#0A006E] ring-2 ring-[#FFDE00]'
                        : 'border-slate-200 opacity-80 hover:opacity-100'
                    }`}
                    title={preset.label}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const svgUri = generateStudioBottleSvgDataUri(productContext || {});
                    onChange(svgUri);
                    setStatusMessage('Generated custom branded bottle illustration.');
                  }}
                  className="rounded-lg overflow-hidden border-2 border-slate-200 hover:border-[#0A006E] h-12 transition"
                  title="Custom Branded Bottle Render"
                >
                  <img
                    src={generateStudioBottleSvgDataUri(productContext || {})}
                    alt="Custom Bottle Render"
                    className="w-full h-full object-cover"
                  />
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
