import React, { useState } from 'react';
import { Building2 } from 'lucide-react';

interface PtWinnersLogoProps {
  className?: string;
  alt?: string;
}

export const PtWinnersLogo: React.FC<PtWinnersLogoProps> = ({
  className = 'w-10 h-10',
  alt = 'PT WINNERS INTERNATIONAL',
}) => {
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-tr from-[#0c2e57] to-[#1a4a82] text-[#ffd23f] rounded-xl shadow-xs border border-[#ffd23f]/30 ${className}`}
        title={alt}
      >
        <Building2 className="w-2/3 h-2/3 text-[#ffd23f]" />
      </div>
    );
  }

  return (
    <img
      src="/logo-perusahaan.png"
      alt={alt}
      onError={() => setImgError(true)}
      className={`${className} object-contain`}
    />
  );
};

export default PtWinnersLogo;
