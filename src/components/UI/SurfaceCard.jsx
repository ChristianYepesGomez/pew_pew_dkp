const SurfaceCard = ({ children, className = '', ...props }) => {
  return (
    <div
      className={`rounded-2xl bg-lavender-12 p-8 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export default SurfaceCard
