import { createElement, forwardRef, isValidElement } from 'react'
import { cn } from '../../utils/cn'

const variants = {
  primary: 'bg-coral text-indigo hover:opacity-90',
  secondary: 'bg-lavender-12 text-cream hover:bg-lavender-20',
  outline: 'border-2 border-lavender-20 text-cream hover:bg-lavender-12',
  ghost: 'text-cream hover:bg-lavender-12',
  success: 'bg-teal text-indigo hover:opacity-90',
  teal: 'bg-teal text-indigo hover:opacity-90',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  warning: 'bg-yellow-600 text-white hover:bg-yellow-700',
}

const sizes = {
  sm: { base: 'h-9 text-sm', padding: 'px-3', icon: 'w-9' },
  md: { base: 'h-10 text-sm', padding: 'px-4', icon: 'w-10' },
  lg: { base: 'h-12 text-base', padding: 'px-5', icon: 'w-12' },
  xl: { base: 'h-14 text-base', padding: 'px-6', icon: 'w-14' },
}

const radii = {
  pill: 'rounded-full',
  soft: 'rounded-xl',
  round: 'rounded-lg',
  none: 'rounded-none',
}

const Button = forwardRef(({
  variant = 'primary',
  size = 'lg',
  radius = 'pill',
  icon: Icon,
  iconRight: IconRight,
  iconOnly = false,
  iconSize = 20,
  fullWidth = false,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  children,
  ...props
}, ref) => {
  const resolvedVariant = variants[variant] || variants.primary
  const resolvedSize = sizes[size] || sizes.lg
  const resolvedRadius = radii[radius] || radii.pill
  const isIconOnly = iconOnly || (!children && (Icon || IconRight))

  const renderIcon = (IconComponent) => {
    if (!IconComponent) return null
    if (isValidElement(IconComponent)) return IconComponent
    if (
      typeof IconComponent !== 'function'
      && typeof IconComponent !== 'object'
      && typeof IconComponent !== 'string'
    ) return null

    return createElement(IconComponent, { size: iconSize, 'aria-hidden': true })
  }

  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender focus-visible:ring-offset-2 focus-visible:ring-offset-indigo disabled:cursor-not-allowed disabled:opacity-50',
        resolvedVariant,
        resolvedSize.base,
        resolvedRadius,
        fullWidth && 'w-full',
        isIconOnly ? resolvedSize.icon : resolvedSize.padding,
        className,
      )}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {renderIcon(Icon)}
      {!isIconOnly && children}
      {!isIconOnly && renderIcon(IconRight)}
    </button>
  )
})

Button.displayName = 'Button'

export default Button
