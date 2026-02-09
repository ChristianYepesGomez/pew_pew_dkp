const SectionHeader = ({ icon: Icon, title, children }) => {
  return (
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {Icon && <Icon size={40} className="text-coral" />}
        <h2 className="text-[28px] font-bold text-coral leading-none">{title}</h2>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}

export default SectionHeader
