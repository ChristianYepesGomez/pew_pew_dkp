import { createContext, useState, useEffect } from 'react'
import { initSocket, disconnectSocket, getSocket } from '../services/socket'
import { useAuth } from '../hooks/useAuth'

export const SocketContext = createContext()

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth()
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)
  const [events, setEvents] = useState({})

  useEffect(() => {
    if (isAuthenticated) {
      const token = localStorage.getItem('token')
      if (token) {
        const newSocket = initSocket(token)
        setSocket(newSocket)

        newSocket.on('connect', () => {
          console.log('✅ Connected to Socket.IO')
          setConnected(true)
        })

        newSocket.on('disconnect', () => {
          console.log('❌ Disconnected from Socket.IO')
          setConnected(false)
        })

        // Listen for custom events
        newSocket.on('dkp_updated', (data) => {
          console.log('💰 DKP updated:', data)
          emitCustomEvent('dkp_updated', data)
        })

        newSocket.on('dkp_bulk_updated', (data) => {
          console.log('💰 Bulk DKP updated:', data)
          emitCustomEvent('dkp_bulk_updated', data)
        })

        newSocket.on('dkp_decay_applied', (data) => {
          console.log('📉 DKP decay applied:', data)
          emitCustomEvent('dkp_decay_applied', data)
        })

        newSocket.on('auction_started', (data) => {
          console.log('🎉 Auction started:', data)
          emitCustomEvent('auction_started', data)
        })

        newSocket.on('bid_placed', (data) => {
          console.log('💵 Bid placed:', data)
          emitCustomEvent('bid_placed', data)
        })

        newSocket.on('auction_ended', (data) => {
          console.log('🏆 Auction ended:', data)
          emitCustomEvent('auction_ended', data)
        })

        newSocket.on('auction_cancelled', (data) => {
          console.log('❌ Auction cancelled:', data)
          emitCustomEvent('auction_cancelled', data)
        })

        newSocket.on('member_updated', (data) => {
          console.log('👤 Member updated:', data)
          emitCustomEvent('member_updated', data)
        })

        newSocket.on('member_removed', (data) => {
          console.log('👤 Member removed:', data)
          emitCustomEvent('member_removed', data)
        })
      }
    } else {
      disconnectSocket()
      setSocket(null)
      setConnected(false)
    }

    return () => {
      disconnectSocket()
    }
  }, [isAuthenticated])

  const emitCustomEvent = (eventName, data) => {
    setEvents((prev) => ({
      ...prev,
      [eventName]: { data, timestamp: Date.now() },
    }))
  }

  const on = (eventName, callback) => {
    if (socket) {
      socket.on(eventName, callback)
    }
  }

  const off = (eventName, callback) => {
    if (socket) {
      socket.off(eventName, callback)
    }
  }

  const emit = (eventName, data) => {
    if (socket) {
      socket.emit(eventName, data)
    }
  }

  const value = {
    socket,
    connected,
    events,
    on,
    off,
    emit,
  }

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  )
}
