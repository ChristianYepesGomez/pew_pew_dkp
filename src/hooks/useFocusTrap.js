import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps focus inside a modal/dialog element.
 * - Auto-focuses the first focusable element on mount
 * - Traps Tab/Shift+Tab within the element
 * - Returns focus to the trigger element on unmount
 */
export function useFocusTrap(ref, isActive = true) {
  const previousActiveElement = useRef(null)

  useEffect(() => {
    if (!isActive) return

    previousActiveElement.current = document.activeElement

    const el = ref.current
    if (!el) return

    // Focus the first focusable element (skip close button, prefer inputs)
    const focusFirst = () => {
      const inputs = el.querySelectorAll('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
      const target = inputs.length > 0 ? inputs[0] : el.querySelector(FOCUSABLE_SELECTOR)
      target?.focus()
    }

    // Small delay to let the DOM settle after portal render
    const timer = setTimeout(focusFirst, 50)

    const handleKeyDown = (e) => {
      if (e.key !== 'Tab') return

      const focusableElements = el.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    el.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      el.removeEventListener('keydown', handleKeyDown)
      // Return focus to trigger element
      previousActiveElement.current?.focus()
    }
  }, [ref, isActive])
}
