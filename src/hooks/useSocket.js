import { useContext, useEffect, useRef } from 'react'
import { SocketContext } from '../context/SocketContext'

export const useSocket = (events = {}) => {
  const context = useContext(SocketContext)
  const eventsRef = useRef(events)

  // Keep eventsRef up to date
  useEffect(() => {
    eventsRef.current = events
  }, [events])

  useEffect(() => {
    if (!context?.socket) return

    const handlers = {}

    // Create stable handlers that reference eventsRef
    Object.keys(eventsRef.current).forEach((event) => {
      handlers[event] = (...args) => {
        if (eventsRef.current[event]) {
          eventsRef.current[event](...args)
        }
      }
      context.socket.on(event, handlers[event])
    })

    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        context.socket.off(event, handler)
      })
    }
  }, [context?.socket])

  return context || { socket: null, isConnected: false }
}