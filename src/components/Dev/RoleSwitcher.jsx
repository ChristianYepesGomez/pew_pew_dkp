/**
 * DEV TOOL: Role Switcher
 * Only visible for admins - allows testing different role views without logging out
 */
import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

const ROLES = [
  { id: null, label: 'Admin (Real)', color: 'bg-red-500' },
  { id: 'officer', label: 'Officer', color: 'bg-yellow-500' },
  { id: 'raider', label: 'Raider', color: 'bg-blue-500' },
]

const RoleSwitcher = () => {
  const { user, realRole, isDevMode, setDevRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  // Only show for actual admins
  if (realRole !== 'admin') return null

  const currentRole = ROLES.find(r => r.id === (isDevMode ? user?.role : null)) || ROLES[0]

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-110 ${
          isDevMode ? 'bg-yellow-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title="DEV: Role Switcher"
      >
        <i className={`fas ${isDevMode ? 'fa-user-secret' : 'fa-bug'}`}></i>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-14 right-0 bg-midnight-deepblue border border-midnight-bright-purple rounded-lg shadow-xl p-2 min-w-[160px]">
          <div className="text-xs text-gray-400 px-2 py-1 border-b border-gray-700 mb-1">
            DEV: View as...
          </div>
          {ROLES.map(role => (
            <button
              key={role.id || 'admin'}
              onClick={() => {
                setDevRole(role.id)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                (isDevMode ? user?.role : null) === role.id
                  ? 'bg-midnight-purple text-white'
                  : 'text-gray-300 hover:bg-midnight-purple hover:bg-opacity-50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${role.color}`}></span>
              {role.label}
              {(isDevMode ? user?.role : null) === role.id && (
                <i className="fas fa-check ml-auto text-green-400"></i>
              )}
            </button>
          ))}
          {isDevMode && (
            <div className="mt-2 pt-2 border-t border-gray-700">
              <div className="text-xs text-yellow-400 px-2 flex items-center gap-1">
                <i className="fas fa-exclamation-triangle"></i>
                Viewing as {user?.role}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default RoleSwitcher
