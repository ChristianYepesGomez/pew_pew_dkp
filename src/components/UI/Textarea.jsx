import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const variants = {
  solid: 'bg-indigo',
  transparent: 'bg-transparent',
  soft: 'bg-lavender-12',
}

const sizes = {
  sm: 'min-h-[96px] px-3 py-2 text-sm',
  md: 'min-h-[112px] px-4 py-2.5 text-sm',
  lg: 'min-h-[128px] px-5 py-3 text-base',
  xl: 'min-h-[160px] px-6 py-4 text-base',
}

const radii = {
  pill: 'rounded-full',
  soft: 'rounded-xl',
  round: 'rounded-lg',
  none: 'rounded-none',
}

const Textarea = forwardRef(({
  variant = 'solid',
  size = 'lg',
  radius = 'soft',
  fullWidth = true,
  invalid = false,
  className = '',
  ...props
}, ref) => {
  const isInvalid = invalid || props['aria-invalid'] === true || props['aria-invalid'] === 'true'

  return (
    <textarea
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(
        'border-2 border-lavender-20 text-cream placeholder:text-lavender placeholder:font-normal placeholder:opacity-50 focus:outline-none focus:border-lavender transition-colors font-normal disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant] || variants.solid,
        sizes[size] || sizes.lg,
        radii[radius] || radii.soft,
        fullWidth && 'w-full',
        isInvalid && 'border-red-400 focus:border-red-400',
        className,
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'

export default Textarea
