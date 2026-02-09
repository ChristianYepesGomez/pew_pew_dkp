const variants = {
  active: 'bg-coral text-indigo',
  inactive: 'bg-lavender-12 text-cream hover:bg-lavender-20',
  ghost: 'text-cream hover:bg-lavender-12',
}

const PillButton = ({ children, icon: Icon, active, variant, iconOnly, className = '', ...props }) => {
  const resolved = variant || (active ? 'active' : 'inactive')
  const base = `flex items-center justify-center gap-2 h-12 shrink-0 whitespace-nowrap rounded-full font-medium text-base transition-colors ${variants[resolved]}`
  const padding = iconOnly ? 'w-12' : 'px-5 py-3'

  return (
    <button className={`${base} ${padding} ${className}`} {...props}>
      {Icon && <Icon size={24} weight={active ? 'bold' : 'regular'} />}
      {!iconOnly && children}
    </button>
  )
}

export default PillButton
