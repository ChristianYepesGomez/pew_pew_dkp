import { useContext, useEffect } from 'react'
import { SocketContext } from '../context/SocketContext'

export const useSocket = (eventHandlers = {}) => {
  const context = useContext(SocketContext)

  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider')
  }

  const { on, off } = context

  useEffect(() => {
    // Register event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      on(event, handler)
    })

    // Cleanup on unmount
    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        off(event, handler)
      })
    }
  }, [eventHandlers, on, off])

  return context
}
