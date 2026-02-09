import { cn } from '../../utils/cn'

const variants = {
  coral: 'bg-coral text-indigo',
  lavender: 'bg-lavender text-indigo',
  teal: 'bg-teal text-indigo',
  indigo: 'bg-indigo text-teal',
  outline: 'border border-lavender-20 text-cream',
}

const sizes = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-3.5 py-2 text-sm',
}

const radii = {
  pill: 'rounded-full',
  soft: 'rounded-xl',
  round: 'rounded-lg',
  none: 'rounded-none',
}

const Badge = ({
  variant = 'coral',
  size = 'sm',
  radius = 'pill',
  className = '',
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-bold leading-none',
        variants[variant] || variants.coral,
        sizes[size] || sizes.sm,
        radii[radius] || radii.pill,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export default Badge
