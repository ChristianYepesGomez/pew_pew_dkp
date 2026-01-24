import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI } from '../../services/api'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
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

  useEffect(() => { loadMembers() }, [])
  useSocket({ dkp_updated: loadMembers, dkp_bulk_updated: loadMembers })

  const handleAdjust = async (memberId, amount) => {
    const reason = amount > 0 ? 'Quick +1' : 'Quick -1'
    try {
      await dkpAPI.adjust(memberId, amount, reason)
      loadMembers()
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  const handleCustomAdjust = async (memberId) => {
    const amount = prompt(t('amount') + ':')
    if (!amount) return
    const reason = prompt(t('reason') + ':', 'Manual adjustment')
    if (!reason) return
    try {
      await dkpAPI.adjust(memberId, parseInt(amount), reason)
      alert(t('dkp_adjusted_successfully'))
      loadMembers()
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card">
      <h3><i className="fas fa-users mr-3"></i>{t('members_list')}</h3>
      <div className="overflow-x-auto">
        <table className="w-full mt-4">
          <thead>
            <tr className="border-b-2 border-midnight-bright-purple">
              <th className="text-left py-3 px-4 text-midnight-glow">{t('character')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">{t('spec')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">{t('role')}</th>
              <th className="text-left py-3 px-4 text-midnight-glow">DKP</th>
              {isAdmin && <th className="text-left py-3 px-4 text-midnight-glow">{t('actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-midnight-bright-purple border-opacity-20 hover:bg-midnight-bright-purple hover:bg-opacity-10">
                <td className="py-3 px-4"><strong style={{ color: CLASS_COLORS[m.character_class] || '#FFF' }}>{m.character_name}</strong></td>
                <td className="py-3 px-4 text-midnight-silver">{m.spec || '-'}</td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${m.raid_role === 'Tank' ? 'bg-blue-500' : m.raid_role === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {m.raid_role || 'DPS'}
                  </span>
                </td>
                <td className="py-3 px-4"><strong className="text-midnight-glow text-lg">{m.current_dkp || 0}</strong></td>
                {isAdmin && (
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button onClick={() => handleAdjust(m.id, 1)} className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm"><i className="fas fa-plus"></i></button>
                      <button onClick={() => handleAdjust(m.id, -1)} className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm"><i className="fas fa-minus"></i></button>
                      <button onClick={() => handleCustomAdjust(m.id)} className="px-3 py-1 bg-midnight-purple hover:bg-midnight-bright-purple text-white rounded-lg text-sm"><i className="fas fa-edit"></i></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.length === 0 && <p className="text-center text-gray-400 py-8">{t('no_members')}</p>}
    </div>
  )
}

export default MembersTab