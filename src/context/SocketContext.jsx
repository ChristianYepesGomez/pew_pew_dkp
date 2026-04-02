import { createContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { queryClient } from '../queryClient'

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

      // React Query cache invalidation on socket events
      newSocket.on('dkp_updated', () => queryClient.invalidateQueries({ queryKey: ['members'] }))
      newSocket.on('dkp_bulk_updated', () => queryClient.invalidateQueries({ queryKey: ['members'] }))
      newSocket.on('member_updated', () => queryClient.invalidateQueries({ queryKey: ['members'] }))
      // Auction events: only invalidate members (DKP changes) — AuctionTab handles auction state directly
      newSocket.on('auction_ended', () => queryClient.invalidateQueries({ queryKey: ['members'] }))

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