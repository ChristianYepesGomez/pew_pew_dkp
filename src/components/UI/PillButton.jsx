import Button from './Button'
import { cn } from '../../utils/cn'

const variantMap = {
  active: 'primary',
  inactive: 'secondary',
  ghost: 'ghost',
}

const PillButton = ({ children, icon, active, variant, iconOnly, size = 'lg', className = '', ...props }) => {
  const resolved = variant || (active ? 'active' : 'inactive')
  const mappedVariant = variantMap[resolved] || resolved

  return (
    <Button
      variant={mappedVariant}
      size={size}
      radius="pill"
      icon={icon}
      iconOnly={iconOnly}
      iconSize={24}
      className={cn('shrink-0 font-medium', className)}
      {...props}
    >
      {children}
    </Button>
  )
}

export default PillButton
