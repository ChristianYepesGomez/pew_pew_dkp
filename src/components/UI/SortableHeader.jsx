import { CaretUp, CaretDown, CaretUpDown } from '@phosphor-icons/react'

const SortableHeader = ({ children, field, sortField, sortDir, onSort, className = '' }) => {
  const isActive = sortField === field
  const handleClick = () => onSort(field)

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1 text-xs font-bold text-cream hover:text-white transition-colors ${className}`}
    >
      {children}
      {isActive ? (
        sortDir === 'asc' ? <CaretUp size={12} /> : <CaretDown size={12} />
      ) : (
        <CaretUpDown size={12} className="text-lavender" />
      )}
    </button>
  )
}

export default SortableHeader
