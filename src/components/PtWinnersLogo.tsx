import React from 'react';

export interface PtWinnersLogoProps {
  className?: string;
  size?: number | string;
  style?: React.CSSProperties;
  alt?: string;
}

/**
 * PT. Winners International logo component
 * Loads from public folder (/logo-perusahaan.png)
 */
export const PtWinnersLogo: React.FC<PtWinnersLogoProps> = ({
  className = 'w-8 h-8',
  size,
  style,
  alt = 'Logo PT. Winners',
}) => {
  const sizeStyle: React.CSSProperties = size
    ? { width: size, height: size, ...style }
    : (style || {});

  return (
    <img
      src="/logo-perusahaan.png"
      alt={alt}
      className={`shrink-0 select-none object-contain rounded-xs ${className}`}
      style={sizeStyle}
      loading="eager"
    />
  );
};

export default PtWinnersLogo;
