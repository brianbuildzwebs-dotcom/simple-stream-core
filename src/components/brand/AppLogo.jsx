import React from 'react';
import { Link } from 'react-router-dom';
import { APP_NAME, LOGO_ICON_URL, LOGO_URL } from '@/lib/brand';

const HEIGHT = {
  xs: { full: 'h-10', icon: 'h-10 w-10' },
  sm: { full: 'h-14', icon: 'h-11 w-11' },
  md: { full: 'h-20', icon: 'h-14 w-14' },
  lg: { full: 'h-24', icon: 'h-16 w-16' },
  xl: { full: 'h-32', icon: 'h-20 w-20' },
  '2xl': { full: 'h-36', icon: 'h-24 w-24' },
};

// Glow is baked into the PNG on lettering only — avoid CSS halos behind the spheres.
const GLOW = '';

export default function AppLogo({
  variant = 'full',
  size = 'md',
  to = '/',
  asLink = false,
  className = '',
  glow = true,
}) {
  const src = variant === 'icon' ? LOGO_ICON_URL : LOGO_URL;
  const dimension = HEIGHT[size]?.[variant] ?? HEIGHT.md[variant];

  const image = (
    <img
      src={src}
      alt={APP_NAME}
      className={`${dimension} w-auto max-w-full object-contain ${glow ? GLOW : ''}`}
      decoding="async"
    />
  );

  if (asLink) {
    return (
      <Link to={to} className={`inline-flex items-center shrink-0 ${className}`}>
        {image}
      </Link>
    );
  }

  return <div className={`inline-flex items-center shrink-0 ${className}`}>{image}</div>;
}