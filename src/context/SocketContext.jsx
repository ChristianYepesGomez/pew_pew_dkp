import { createContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'

export const SocketContext = createContext()

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const { token, isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated && token) {
      const newSocket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
      })

      newSocket.on('connect', () => {
        console.log('✅ Socket connected')
        setIsConnected(true)
      })

      newSocket.on('disconnect', () => {
        console.log('❌ Socket disconnected')
        setIsConnected(false)
      })

      setSocket(newSocket)

      return () => {
        newSocket.disconnect()
      }
    }
  }, [isAuthenticated, token])

  const value = {
    socket,
    isConnected,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}