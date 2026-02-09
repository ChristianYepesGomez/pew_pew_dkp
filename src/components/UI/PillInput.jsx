const PillInput = ({ className = '', ...props }) => {
  return (
    <input
      className={`h-12 rounded-full border-2 border-lavender-20 bg-transparent px-5 text-base font-medium text-cream placeholder:text-lavender focus:border-lavender focus:outline-none transition-colors ${className}`}
      {...props}
    />
  )
}

export default PillInput
