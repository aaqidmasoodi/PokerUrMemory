import { useState } from 'react';

export function Avatar({
  url,
  name,
  size = 'md',
  className = '',
}: {
  url?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  // Use the first code point (not code unit) so emoji / surrogate pairs don't break.
  const initial = ([...name][0] ?? '').toUpperCase();

  const sizeClass = size === 'sm' ? 'w-9 h-9 text-sm'
    : size === 'lg' ? 'w-20 h-20 text-2xl'
    : 'w-10 h-10 text-base';

  if (url && !imgFailed) {
    return (
      <img
        src={url}
        alt={name}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div className={`${sizeClass} rounded-full bg-gradient-to-br from-[color:var(--color-blue)] to-[color:var(--color-blue-soft)] text-white flex items-center justify-center font-bold ${className}`}>
      {initial}
    </div>
  );
}
