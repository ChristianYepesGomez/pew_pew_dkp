import { useEffect, useRef } from 'react'
import { cn } from '../../utils/cn'

const PopoverMenu = ({
  open,
  onOpenChange,
  trigger,
  menuId,
  placement = 'right',
  containerClassName = '',
  menuClassName = '',
  children,
}) => {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        onOpenChange(false)
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onOpenChange(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onOpenChange])

  const triggerProps = {
    type: 'button',
    onClick: () => onOpenChange(!open),
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': open && menuId ? menuId : undefined,
  }

  return (
    <div ref={containerRef} className={cn('relative', containerClassName)}>
      {trigger?.({ open, triggerProps, close: () => onOpenChange(false) })}

      {open && (
        <div
          id={menuId}
          role="menu"
          className={cn(
            'absolute z-50 mt-2 rounded-2xl border-2 border-lavender-20 bg-lavender-12-solid p-2 shadow-xl',
            placement === 'left' ? 'left-0' : 'right-0',
            menuClassName,
          )}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export const PopoverMenuItem = ({
  onClick,
  leading = null,
  trailing = null,
  className = '',
  children,
  ...props
}) => (
  <button
    type="button"
    role="menuitem"
    className={cn(
      'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium text-cream transition-colors hover:bg-lavender-20',
      trailing && 'justify-between',
      className,
    )}
    onClick={onClick}
    {...props}
  >
    <span className="flex items-center gap-3">
      {leading}
      {children}
    </span>
    {trailing}
  </button>
)

export const PopoverMenuDivider = ({ className = '' }) => (
  <div className={cn('-mx-2 my-1 h-px bg-lavender-20/15', className)} />
)

export default PopoverMenu
