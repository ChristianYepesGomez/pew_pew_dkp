import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const variants = {
  solid: 'bg-indigo',
  transparent: 'bg-transparent',
  soft: 'bg-lavender-12',
}

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
  xl: 'h-14 px-6 text-base',
}

const radii = {
  pill: 'rounded-full',
  soft: 'rounded-xl',
  round: 'rounded-lg',
  none: 'rounded-none',
}

const Input = forwardRef(({
  variant = 'solid',
  size = 'lg',
  radius = 'pill',
  fullWidth = true,
  invalid = false,
  className = '',
  ...props
}, ref) => {
  const isInvalid = invalid || props['aria-invalid'] === true || props['aria-invalid'] === 'true'

  return (
    <input
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(
        'outline outline-2 outline-lavender-20 border-none text-cream placeholder:text-lavender placeholder:font-normal placeholder:opacity-40 focus:outline-lavender transition-colors font-normal disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant] || variants.solid,
        sizes[size] || sizes.lg,
        radii[radius] || radii.soft,
        fullWidth && 'w-full',
        isInvalid && 'outline-red-400 focus:outline-red-400',
        className,
      )}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input
