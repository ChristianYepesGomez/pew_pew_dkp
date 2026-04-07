import { createContext, useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from '../hooks/useAuth'
import { queryClient } from '../queryClient'

export const SocketContext = createContext()

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const { isAuthenticated } = useAuth()

  useEffect(() => {
    if (isAuthenticated) {
      const newSocket = io(SOCKET_URL, {
        // Function form: re-read token from localStorage on every (re)connection.
        // The axios interceptor refreshes the access token silently on 401 but only
        // writes to localStorage — if we froze `token` here as an object, the socket
        // would keep retrying with the stale (expired) token after any disconnect and
        // the io.use JWT middleware would reject the handshake forever.
        // Depending only on `isAuthenticated` (not `token`) avoids tearing down the
        // socket every time a refresh happens — reconnection picks up the new token
        // from localStorage automatically.
        auth: (cb) => cb({ token: localStorage.getItem('token') }),
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
  }, [isAuthenticated])

  const value = {
    socket,
    isConnected,
  }

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}