import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E',
  Paladin: '#F58CBA',
  Hunter: '#ABD473',
  Rogue: '#FFF569',
  Priest: '#FFFFFF',
  Shaman: '#0070DE',
  Mage: '#40C7EB',
  Warlock: '#8788EE',
  Druid: '#FF7D0A',
  'Death Knight': '#C41F3B',
}

const MembersTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const isAdmin = user?.role === 'admin' || user?.role === 'officer'

  const loadMembers = async () => {
    try {
      const response = await membersAPI.getAll()
      setMembers(response.data)
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [])

  // Listen to socket updates
  useSocket({
    member_updated: () => loadMembers(),
    member_removed: () => loadMembers(),
    dkp_updated: () => loadMembers(),
    dkp_bulk_updated: () => loadMembers(),
    dkp_decay_applied: () => loadMembers(),
  })

  const handleQuickAdjust = async (memberId, amount) => {
    const member = members.find(m => m.id === memberId)
    const reason = amount > 0 ? 'Quick adjustment (+1)' : 'Quick adjustment (-1)'

    try {
      await dkpAPI.adjust(memberId, amount, reason)
      loadMembers()
    } catch (error) {
      console.error('Error adjusting DKP:', error)
      alert(t('error_adjusting_dkp'))
    }
  }

  const handleCustomAdjust = async (memberId, characterName) => {
    const amount = prompt(t('amount') + ':', '0')
    if (amount === null) return

    const amountNum = parseInt(amount)
    if (isNaN(amountNum) || amountNum === 0) {
      alert(t('please_complete_fields'))
      return
    }

    const reason = prompt(t('reason') + ':', 'Manual adjustment')
    if (reason === null) return

    try {
      await dkpAPI.adjust(memberId, amountNum, reason || 'Manual adjustment')
      alert(t('dkp_adjusted_successfully'))
      loadMembers()
    } catch (error) {
      console.error('Error adjusting DKP:', error)
      alert(t('error_adjusting_dkp'))
    }
  }

  if (loading) {
    return (
      <div className="text-center py-20">
        <i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i>
        <p className="mt-4 text-midnight-silver">{t('loading')}...</p>
      </div>
    )
  }

  return (
    <div className="info-card">
      <h3>
        <i className="fas fa-users mr-3"></i>
        {t('members_list')}
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-midnight-bright-purple">
              <th className="text-left py-3 px-4 text-midnight-glow">{t('character')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">{t('spec')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">{t('role')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">DKP</th>
              {isAdmin && (
                <th className="text-left py-3 px-4 text-midnight-glow">{t('actions')}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const classColor = CLASS_COLORS[member.character_class] || '#FFFFFF'

              return (
                <tr
                  key={member.id}
                  className="border-b border-midnight-bright-purple border-opacity-20 hover:bg-midnight-bright-purple hover:bg-opacity-10 transition-all"
                >
                  <td className="py-3 px-4">
                    <strong style={{ color: classColor, textShadow: `0 0 8px ${classColor}` }}>
                      {member.character_name}
                    </strong>
                  </td>
                  <td className="py-3 px-4 text-midnight-silver">{member.spec || '-'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        member.raid_role === 'Tank'
                          ? 'bg-blue-500 text-white'
                          : member.raid_role === 'Healer'
                          ? 'bg-green-500 text-white'
                          : 'bg-red-500 text-white'
                      }`}
                    >
                      {member.raid_role || 'DPS'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <strong className="text-midnight-glow text-lg">
                      {member.current_dkp || 0}
                    </strong>
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleQuickAdjust(member.id, 1)}
                          className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-all"
                          title={t('add_dkp')}
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                        <button
                          onClick={() => handleQuickAdjust(member.id, -1)}
                          className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-all"
                          title={t('subtract_dkp')}
                        >
                          <i className="fas fa-minus"></i>
                        </button>
                        <button
                          onClick={() => handleCustomAdjust(member.id, member.character_name)}
                          className="px-3 py-1 bg-midnight-purple hover:bg-midnight-bright-purple text-white rounded-lg text-sm transition-all"
                          title={t('custom_adjustment')}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {members.length === 0 && (
        <p className="text-center text-gray-400 py-8">{t('no_members')}</p>
      )}
    </div>
  )
}

export default MembersTab
