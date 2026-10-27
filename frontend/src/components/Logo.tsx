export function ShieldLogo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 64 74" role="img" aria-label="VideoGuard AI logo">
      <defs><linearGradient id="vgShield" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#29b6ff" /><stop offset="1" stopColor="#0b63f6" /></linearGradient></defs>
      <path d="M32 2 60 12v24c0 18-12 30-28 36C16 66 4 54 4 36V12z" fill="url(#vgShield)" />
      <path d="M32 9 54 17v19c0 14-9 24-22 29C19 60 10 50 10 36V17z" fill="#061a45" />
      <circle cx="32" cy="36" r="10" fill="none" stroke="#fff" strokeWidth="3" /><circle cx="32" cy="36" r="4" fill="#29b6ff" />
    </svg>
  );
}
