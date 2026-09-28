import React from 'react';

export const BkashIcon: React.FC<{ className?: string, size?: number }> = ({ className = '', size = 24 }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    {/* Body / main triangle */}
    <polygon points="48,21 64,54 43,49" fill="#E2136E" />
    {/* Top wing */}
    <polygon points="48,21 43,49 26,17" fill="#C31357" />
    <polygon points="26,17 43,49 29,35" fill="#E2136E" />
    {/* Bottom wing */}
    <polygon points="43,49 64,54 46,67" fill="#E2136E" />
    <polygon points="43,49 46,67 36,83" fill="#8F0D36" />
    {/* Beak */}
    <polygon points="64,54 69,38 73,44" fill="#E2136E" />
    <polygon points="69,38 58,40 64,54" fill="#C31357" />
  </svg>
);
