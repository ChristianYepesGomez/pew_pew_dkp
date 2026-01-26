import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useSocket } from '../../hooks/useSocket'
import { useLanguage } from '../../hooks/useLanguage'
import { membersAPI, dkpAPI } from '../../services/api'
import DKPAdjustModal from './DKPAdjustModal'
import CreateMemberModal from './CreateMemberModal'

const CLASS_COLORS = {
  Warrior: '#C79C6E', Paladin: '#F58CBA', Hunter: '#ABD473', Rogue: '#FFF569', Priest: '#FFFFFF',
  Shaman: '#0070DE', Mage: '#40C7EB', Warlock: '#8788EE', Druid: '#FF7D0A', 'Death Knight': '#C41F3B',
}

const MembersTab = () => {
  const { user } = useAuth()
  const { t } = useLanguage()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [adjustModal, setAdjustModal] = useState({ open: false, member: null })
  const [createModal, setCreateModal] = useState(false)
  const isAdmin = user?.role === 'admin'

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
  useSocket({ dkp_updated: loadMembers, dkp_bulk_updated: loadMembers, member_updated: loadMembers })

  const handleOpenAdjust = (member) => {
    setAdjustModal({ open: true, member })
  }

  const handleAdjustSubmit = async (amount, reason) => {
    try {
      await dkpAPI.adjust(adjustModal.member.id, amount, reason)
      loadMembers()
      setAdjustModal({ open: false, member: null })
    } catch (error) {
      alert(t('error_adjusting_dkp'))
    }
  }

  const handleCreateMember = () => {
    loadMembers()
    setCreateModal(false)
  }

  if (loading) return <div className="text-center py-20"><i className="fas fa-circle-notch fa-spin text-6xl text-midnight-glow"></i></div>

  return (
    <div className="info-card flex flex-col" style={{ maxHeight: 'calc(100vh - 200px)' }}>
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="m-0"><i className="fas fa-users mr-3"></i>{t('members_list')}</h3>
        {isAdmin && (
          <button
            onClick={() => setCreateModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
          >
            <i className="fas fa-user-plus"></i>
            {t('create_member')}
          </button>
        )}
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full">
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
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <strong style={{ color: CLASS_COLORS[m.character_class] || '#FFF' }}>{m.character_name}</strong>
                    {m.role === 'admin' && <span className="px-2 py-0.5 rounded text-xs bg-yellow-600 text-white">Admin</span>}
                    {m.role === 'officer' && <span className="px-2 py-0.5 rounded text-xs bg-purple-600 text-white">Oficial</span>}
                  </div>
                </td>
                <td className="py-3 px-4 text-midnight-silver">{m.spec || '-'}</td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${m.raid_role === 'Tank' ? 'bg-blue-500' : m.raid_role === 'Healer' ? 'bg-green-500' : 'bg-red-500'} text-white`}>
                    {m.raid_role || 'DPS'}
                  </span>
                </td>
                <td className="py-3 px-4"><strong className="text-midnight-glow text-lg">{m.current_dkp || 0}</strong></td>
                {isAdmin && (
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleOpenAdjust(m)}
                      className="px-4 py-2 bg-gradient-to-r from-midnight-purple to-midnight-bright-purple text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
                    >
                      <i className="fas fa-coins"></i>
                      {t('adjust_dkp')}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {members.length === 0 && <p className="text-center text-gray-400 py-8">{t('no_members')}</p>}

      {/* DKP Adjust Modal */}
      {adjustModal.open && (
        <DKPAdjustModal
          member={adjustModal.member}
          onClose={() => setAdjustModal({ open: false, member: null })}
          onSubmit={handleAdjustSubmit}
        />
      )}

      {/* Create Member Modal */}
      {createModal && (
        <CreateMemberModal
          onClose={() => setCreateModal(false)}
          onSuccess={handleCreateMember}
        />
      )}
    </div>
  )
}

export default MembersTab