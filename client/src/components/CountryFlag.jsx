import React from 'react';

/**
 * High-definition vector flags with crisp borders and soft shadows.
 * Solves the Windows Chrome issue where flag emojis render as monochrome or 2-letter ISO codes.
 */
export function MadagascarFlag({ className = 'w-16 h-11', rounded = 'rounded-xl' }) {
  return (
    <svg
      viewBox="0 0 900 600"
      className={`${className} ${rounded} shadow-md border border-slate-700/60 overflow-hidden flex-shrink-0`}
      aria-label="Drapeau de Madagascar"
    >
      {/* Madagascar National Flag: White vertical band (left 1/3), Red top-right (1/2 height), Green bottom-right (1/2 height) */}
      <rect width="900" height="600" fill="#007E3A" />
      <rect width="900" height="300" fill="#FC3D32" />
      <rect width="300" height="600" fill="#FFFFFF" />
    </svg>
  );
}

export function FranceFlag({ className = 'w-16 h-11', rounded = 'rounded-xl' }) {
  return (
    <svg
      viewBox="0 0 900 600"
      className={`${className} ${rounded} shadow-md border border-slate-700/60 overflow-hidden flex-shrink-0`}
      aria-label="Drapeau de la France"
    >
      {/* French Tricolore: Blue, White, Red equal vertical stripes */}
      <rect width="300" height="600" fill="#0055A4" />
      <rect x="300" width="300" height="600" fill="#FFFFFF" />
      <rect x="600" width="300" height="600" fill="#EF4135" />
    </svg>
  );
}

export function UKFlag({ className = 'w-16 h-11', rounded = 'rounded-xl' }) {
  return (
    <svg
      viewBox="0 0 60 30"
      className={`${className} ${rounded} shadow-md border border-slate-700/60 overflow-hidden flex-shrink-0`}
      aria-label="Flag of the United Kingdom"
    >
      {/* Official geometry of Union Flag */}
      <clipPath id="s">
        <path d="M0,0 v30 h60 v-30 z"/>
      </clipPath>
      <clipPath id="t">
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/>
      </clipPath>
      <g clipPath="url(#s)">
        <path d="M0,0 v30 h60 v-30 z" fill="#012169"/>
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6"/>
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#t)" stroke="#C8102E" strokeWidth="4"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10"/>
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6"/>
      </g>
    </svg>
  );
}

export default function CountryFlag({ code, className = 'w-16 h-11', rounded = 'rounded-xl' }) {
  switch (code?.toLowerCase()) {
    case 'mg':
      return <MadagascarFlag className={className} rounded={rounded} />;
    case 'fr':
      return <FranceFlag className={className} rounded={rounded} />;
    case 'en':
    case 'gb':
    case 'uk':
      return <UKFlag className={className} rounded={rounded} />;
    default:
      return null;
  }
}

