import Input from './Input'

const PillInput = ({ className = '', size = 'lg', ...props }) => {
  return (
    <Input
      variant="transparent"
      size={size}
      radius="pill"
      className={className}
      {...props}
    />
  )
}

export default PillInput
