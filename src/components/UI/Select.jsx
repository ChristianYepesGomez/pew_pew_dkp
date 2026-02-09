import { forwardRef } from 'react'
import { cn } from '../../utils/cn'

const chevron = "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22%23b1a7d0%22%20viewBox%3D%220%200%20256%20256%22%3E%3Cpath%20d%3D%22M213.66%2C101.66l-80%2C80a8%2C8%2C0%2C0%2C1-11.32%2C0l-80-80A8%2C8%2C0%2C0%2C1%2C53.66%2C90.34L128%2C164.69l74.34-74.35a8%2C8%2C0%2C0%2C1%2C11.32%2C11.32Z%22%2F%3E%3C%2Fsvg%3E')]"

const variants = {
  solid: 'bg-indigo',
  transparent: 'bg-transparent',
  soft: 'bg-lavender-12',
}

const sizes = {
  sm: 'h-9 pl-3 pr-8 text-sm bg-[position:right_12px_center]',
  md: 'h-10 pl-4 pr-9 text-sm bg-[position:right_14px_center]',
  lg: 'h-12 pl-5 pr-10 text-base bg-[position:right_16px_center]',
  xl: 'h-14 pl-6 pr-12 text-base bg-[position:right_18px_center]',
}

const radii = {
  pill: 'rounded-full',
  soft: 'rounded-xl',
  round: 'rounded-lg',
  none: 'rounded-none',
}

const Select = forwardRef(({
  variant = 'solid',
  size = 'lg',
  radius = 'pill',
  fullWidth = true,
  invalid = false,
  className = '',
  children,
  ...props
}, ref) => {
  const isInvalid = invalid || props['aria-invalid'] === true || props['aria-invalid'] === 'true'

  return (
    <select
      ref={ref}
      aria-invalid={isInvalid || undefined}
      className={cn(
        'appearance-none border-2 border-lavender-20 text-cream focus:outline-none focus:border-lavender transition-colors font-normal disabled:cursor-not-allowed disabled:opacity-60 bg-no-repeat',
        chevron,
        variants[variant] || variants.solid,
        sizes[size] || sizes.lg,
        radii[radius] || radii.soft,
        fullWidth && 'w-full',
        isInvalid && 'border-red-400 focus:border-red-400',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
})

Select.displayName = 'Select'

export default Select
