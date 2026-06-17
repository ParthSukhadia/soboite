import { Banknote } from 'lucide-react';

interface PriceLevelIconProps {
  level?: number;
  actualPrice?: number;
  noteSize?: number;
  className?: string;
}

export default function PriceLevelIcon({
  level,
  actualPrice,
  noteSize = 12,
  className = ''
}: PriceLevelIconProps) {
  const safeLevel = Math.min(3, Math.max(1, Math.round(level ?? 1)));

  let denomination = 100;
  if (typeof actualPrice === 'number' && Number.isFinite(actualPrice)) {
    if (actualPrice >= 500) {
      denomination = 500;
    } else if (actualPrice >= 200) {
      denomination = 200;
    }
  } else {
    denomination = safeLevel >= 3 ? 500 : (safeLevel === 2 ? 200 : 100);
  }

  const getNoteColor = (denomination: number) => {
    if (denomination === 100) return '#9b8ad1';
    if (denomination === 200) return '#ee9a3a';
    return '#7f8677';
  };

  return (
    <span className={`relative inline-flex h-6 w-6 items-center justify-center ${className}`} aria-hidden="true">
      <Banknote
        size={noteSize}
        className="absolute"
        style={{
          color: getNoteColor(denomination),
          opacity: 0.95
        }}
        strokeWidth={2.1}
      />
    </span>
  );
}
