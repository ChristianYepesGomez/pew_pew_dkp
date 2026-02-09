const colorMap = {
  coral: 'bg-coral text-indigo',
  lavender: 'bg-lavender text-indigo',
  teal: 'bg-teal text-indigo',
  indigo: 'bg-indigo text-teal',
}

const PillBadge = ({ children, color = 'coral', className = '', ...props }) => {
  const colors = colorMap[color] || colorMap.coral

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-bold leading-none ${colors} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

export default PillBadge
