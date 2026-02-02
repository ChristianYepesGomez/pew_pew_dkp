import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

let socket = null

export const initSocket = (token) => {
  if (socket) {
    socket.disconnect()
  }

  socket = io(SOCKET_URL, {
    auth: { token },
  })

  return socket
}

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}

export const getSocket = () => socket

export default { initSocket, disconnectSocket, getSocket }
