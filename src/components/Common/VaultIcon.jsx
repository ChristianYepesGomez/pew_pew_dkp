// Great Vault Icon SVG Component
const VaultIcon = ({ completed = false, size = 24 }) => {
  const plateColor = completed ? '#c0c0c0' : '#606060'
  const plateBorder = completed ? '#8a8a8a' : '#404040'
  const scrollColor = completed ? '#d4a017' : '#5a5a5a'
  const scrollHighlight = completed ? '#ffd700' : '#707070'
  const keyholeColor = completed ? '#1a1a1a' : '#2a2a2a'
  const glowOpacity = completed ? '0.6' : '0'

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`vaultGlow-${completed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffd700" stopOpacity={glowOpacity} />
          <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`plateGrad-${completed}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={completed ? '#e0e0e0' : '#707070'} />
          <stop offset="50%" stopColor={plateColor} />
          <stop offset="100%" stopColor={completed ? '#909090' : '#505050'} />
        </linearGradient>
      </defs>

      {/* Background glow */}
      <circle cx="16" cy="16" r="15" fill={`url(#vaultGlow-${completed})`} />

      {/* Corner scrolls/pillars */}
      {/* Top-left */}
      <g transform="translate(2,2) rotate(-45, 5, 5)">
        <rect x="1" y="3" width="8" height="4" rx="2" fill={scrollColor} />
        <rect x="0" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
        <rect x="7" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
      </g>
      {/* Top-right */}
      <g transform="translate(22,2) rotate(45, 5, 5)">
        <rect x="1" y="3" width="8" height="4" rx="2" fill={scrollColor} />
        <rect x="0" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
        <rect x="7" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
      </g>
      {/* Bottom-left */}
      <g transform="translate(2,22) rotate(45, 5, 5)">
        <rect x="1" y="3" width="8" height="4" rx="2" fill={scrollColor} />
        <rect x="0" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
        <rect x="7" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
      </g>
      {/* Bottom-right */}
      <g transform="translate(22,22) rotate(-45, 5, 5)">
        <rect x="1" y="3" width="8" height="4" rx="2" fill={scrollColor} />
        <rect x="0" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
        <rect x="7" y="2" width="2" height="6" rx="1" fill={scrollHighlight} />
      </g>

      {/* Central octagonal plate */}
      <polygon
        points="16,6 22,9 25,16 22,23 16,26 10,23 7,16 10,9"
        fill={`url(#plateGrad-${completed})`}
        stroke={plateBorder}
        strokeWidth="1"
      />

      {/* Inner octagon border */}
      <polygon
        points="16,8 20,10 22,16 20,22 16,24 12,22 10,16 12,10"
        fill="none"
        stroke={plateBorder}
        strokeWidth="0.5"
        opacity="0.5"
      />

      {/* Keyhole - circle part */}
      <circle cx="16" cy="13" r="3" fill={keyholeColor} />

      {/* Keyhole - bottom part */}
      <polygon points="14,14 18,14 17,22 15,22" fill={keyholeColor} />
    </svg>
  )
}

export default VaultIcon
