import { CaretDown } from '@phosphor-icons/react'

const SortableHeader = ({ children, field, sortField, sortDir, onSort, className = '' }) => {
  const isActive = sortField === field
  const handleClick = () => onSort(field)

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group inline-flex items-center gap-1 text-xs font-bold text-cream hover:text-white transition-colors ${className}`}
      aria-pressed={isActive}
    >
      {children}
      {isActive ? (
        <CaretDown
          size={12}
          weight="bold"
          className={`transition-transform duration-150 ${sortDir === 'asc' ? 'rotate-180' : 'rotate-0'}`}
        />
      ) : (
        <CaretDown
          size={12}
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-60 group-focus-visible:opacity-60"
          aria-hidden="true"
        />
      )}
    </button>
  )
}

export default SortableHeader
