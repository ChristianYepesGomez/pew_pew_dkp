import Select from './Select'

const PillSelect = ({ children, className = '', size = 'lg', ...props }) => {
  return (
    <Select
      variant="transparent"
      size={size}
      radius="pill"
      className={className}
      {...props}
    >
      {children}
    </Select>
  )
}

export default PillSelect
