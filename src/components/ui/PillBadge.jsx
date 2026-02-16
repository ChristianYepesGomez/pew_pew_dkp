import Badge from './Badge'

const PillBadge = ({ children, color = 'coral', className = '', ...props }) => {
  return (
    <Badge
      variant={color}
      size="sm"
      radius="pill"
      className={className}
      {...props}
    >
      {children}
    </Badge>
  )
}

export default PillBadge
