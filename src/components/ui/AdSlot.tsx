import React from 'react';

export interface AdSlotProps {
  slotId?: string;
  format?: 'banner' | 'rectangle' | 'responsive';
  className?: string;
}

/**
 * Extension point for future non-intrusive sponsorships or developer-relevant ads.
 * In Version 1, this component is completely inactive and renders no scripts or trackers.
 */
export const AdSlot: React.FC<AdSlotProps> = ({
  slotId = 'default',
  format = 'responsive',
  className = ''
}) => {
  // Ads disabled for v1 release
  const ADS_ENABLED = false;

  if (!ADS_ENABLED) {
    return null;
  }

  return (
    <div
      data-ad-slot={slotId}
      data-ad-format={format}
      className={`ad-container my-6 p-4 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-500 ${className}`}
      aria-hidden="true"
    />
  );
};
