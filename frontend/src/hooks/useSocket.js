import { useContext, useEffect } from 'react'
import { SocketContext } from '../context/SocketContext'

export const useSocket = (events = {}) => {
  const context = useContext(SocketContext)

  useEffect(() => {
    if (!context?.socket) return

    Object.entries(events).forEach(([event, handler]) => {
      context.socket.on(event, handler)
    })

    return () => {
      Object.entries(events).forEach(([event, handler]) => {
        context.socket.off(event, handler)
      })
    }
  }, [context?.socket, events])

  return context || { socket: null, isConnected: false }
}