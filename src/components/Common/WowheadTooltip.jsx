import { useEffect, useRef } from 'react'

const WowheadTooltip = ({ itemId, children, className = '' }) => {
  const ref = useRef(null)
  const combinedClassName = `link-reset ${className}`.trim()

  useEffect(() => {
    if (itemId && window.$WowheadPower) {
      window.$WowheadPower.refreshLinks()
    }
  }, [itemId])

  if (!itemId) return <span className={className}>{children}</span>

  return (
    <a
      ref={ref}
      href={`https://www.wowhead.com/item=${itemId}`}
      data-wowhead={`item=${itemId}`}
      target="_blank"
      rel="noopener noreferrer"
      className={combinedClassName}
      onClick={(e) => e.preventDefault()}
    >
      {children}
    </a>
  )
}

export default WowheadTooltip
