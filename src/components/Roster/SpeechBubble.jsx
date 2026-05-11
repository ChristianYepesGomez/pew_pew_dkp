import { useState, useEffect, useRef } from 'react'

/**
 * Hook that drives random speech bubble timing for a single player.
 * Each player independently schedules its next bubble after mounting.
 *
 * @param {string[]} phrases  - Pool of phrases to pick from
 * @param {object}   opts
 * @param {number}   opts.minDelay - Minimum ms before first (and subsequent) bubble
 * @param {number}   opts.maxDelay - Maximum ms before first (and subsequent) bubble
 * @returns {{ text: string, visible: boolean }}
 */
export function useSpeechBubble(phrases, { minDelay = 8000, maxDelay = 20000 } = {}) {
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    const DISPLAY_MS = 3200  // how long the bubble stays visible
    const FADE_MS    = 400   // must match CSS animation duration

    function scheduleNext() {
      // Random delay before the next bubble (between min and max)
      const delay = minDelay + Math.random() * (maxDelay - minDelay)
      timerRef.current = setTimeout(() => {
        const phrase = phrases[Math.floor(Math.random() * phrases.length)]
        setText(phrase)
        setVisible(true)

        // Hide after DISPLAY_MS (the fade-out animation runs for FADE_MS)
        timerRef.current = setTimeout(() => {
          setVisible(false)
          // Schedule the next one after it has fully faded
          timerRef.current = setTimeout(scheduleNext, FADE_MS + 200)
        }, DISPLAY_MS)
      }, delay)
    }

    // Stagger the very first appearance by adding a random initial offset
    // so all players don't fire at the same time on mount.
    const initialJitter = Math.random() * (maxDelay - minDelay)
    timerRef.current = setTimeout(scheduleNext, initialJitter)

    return () => clearTimeout(timerRef.current)
  }, []) // intentionally only run on mount/unmount

  return { text, visible }
}

// Shared bubble body styles
const BUBBLE_STYLE = {
  background: 'linear-gradient(135deg, rgba(177,167,208,0.22), rgba(255,175,157,0.16))',
  border: '1px solid rgba(177,167,208,0.35)',
  backdropFilter: 'blur(8px)',
  whiteSpace: 'normal',
}

/**
 * Speech bubble that appears above an element (for Stands seats).
 * Anchor: the bubble arrow points downward toward the seat.
 */
export function SpeechBubbleAbove({ text, visible }) {
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-full left-1/2 mb-2 pointer-events-none"
      style={{
        // Keep the centering transform as the base; animation overrides with translateX(-50%)+Y shift
        transform: 'translateX(-50%)',
        zIndex: 50,
        animation: visible
          ? 'bubble-in 0.3s ease forwards'
          : 'bubble-out 0.35s ease forwards',
      }}
    >
      {/* Bubble body */}
      <div
        className="px-2 py-1.5 rounded-lg text-[10px] font-semibold leading-snug text-[#ffeccd] shadow-xl text-center"
        style={{ ...BUBBLE_STYLE, maxWidth: 110 }}
      >
        {text}
      </div>
      {/* Arrow pointing down */}
      <div
        className="absolute left-1/2"
        style={{
          transform: 'translateX(-50%)',
          bottom: -5,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid rgba(177,167,208,0.35)',
        }}
      />
    </div>
  )
}

/**
 * Speech bubble that appears to the right of an element (for bench list rows).
 * Anchor: the bubble arrow points left toward the player row.
 */
export function SpeechBubbleRight({ text, visible }) {
  return (
    <div
      aria-hidden="true"
      className="absolute left-full top-1/2 ml-2 pointer-events-none"
      style={{
        transform: 'translateY(-50%)',
        zIndex: 50,
        animation: visible
          ? 'bubble-in-right 0.3s ease forwards'
          : 'bubble-out 0.35s ease forwards',
      }}
    >
      {/* Arrow pointing left */}
      <div
        className="absolute top-1/2"
        style={{
          transform: 'translateY(-50%)',
          left: -5,
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderRight: '5px solid rgba(177,167,208,0.35)',
        }}
      />
      {/* Bubble body */}
      <div
        className="px-2 py-1.5 rounded-lg text-[10px] font-semibold leading-snug text-[#ffeccd] shadow-xl"
        style={{ ...BUBBLE_STYLE, maxWidth: 130 }}
      >
        {text}
      </div>
    </div>
  )
}
