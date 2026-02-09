import { useState } from 'react'
import { Bug, UserCircle, Check, Warning } from '@phosphor-icons/react'
import { useAuth } from '../../hooks/useAuth'

const ROLES = [
  { id: null, label: 'Admin (Real)', color: 'bg-red-500' },
  { id: 'officer', label: 'Officer', color: 'bg-yellow-500' },
  { id: 'raider', label: 'Raider', color: 'bg-blue-500' },
]

const RoleSwitcher = () => {
  const { user, realRole, isDevMode, setDevRole } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (realRole !== 'admin') return null

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white transition-all hover:scale-110 ${
          isDevMode ? 'bg-yellow-500 animate-pulse' : 'bg-gray-700 hover:bg-gray-600'
        }`}
        title="DEV: Role Switcher"
      >
        {isDevMode ? <UserCircle size={24} /> : <Bug size={24} />}
      </button>

      {isOpen && (
        <div className="absolute bottom-14 right-0 bg-indigo border-2 border-lavender-20 rounded-2xl shadow-xl p-2 min-w-[160px]">
          <div className="text-xs text-lavender px-2 py-1 border-b border-lavender-20 mb-1">
            DEV: View as...
          </div>
          {ROLES.map(role => (
            <button
              key={role.id || 'admin'}
              onClick={() => {
                setDevRole(role.id)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors ${
                (isDevMode ? user?.role : null) === role.id
                  ? 'bg-lavender-12 text-cream'
                  : 'text-lavender hover:bg-lavender-12'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${role.color}`}></span>
              {role.label}
              {(isDevMode ? user?.role : null) === role.id && (
                <Check size={14} className="ml-auto text-teal" />
              )}
            </button>
          ))}
          {isDevMode && (
            <div className="mt-2 pt-2 border-t border-lavender-20">
              <div className="text-xs text-yellow-400 px-2 flex items-center gap-1">
                <Warning size={12} />
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
