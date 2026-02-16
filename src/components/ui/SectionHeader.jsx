const SectionHeader = ({ icon: Icon, title, children }) => {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        {Icon && <Icon size={34} className="shrink-0 text-coral" />}
        <h2 className="text-2xl font-bold leading-tight text-coral">{title}</h2>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:gap-3">{children}</div>}
    </div>
  )
}

export default SectionHeader
