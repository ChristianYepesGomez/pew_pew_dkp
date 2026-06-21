import { Trophy, Heart } from '@phosphor-icons/react'
import { useLanguage } from '../../hooks/useLanguage'

const GuildDisbandedBanner = () => {
  const { t } = useLanguage()

  return (
    <div className="w-full bg-gradient-to-r from-teal/20 via-lavender-12 to-coral/20 border-b border-teal/30 px-4 py-3 text-center">
      <div className="mx-auto flex max-w-[960px] flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
        <span className="flex items-center gap-2 font-bold text-coral text-base sm:text-lg">
          <Trophy size={20} className="text-teal shrink-0" weight="fill" />
          {t('guild_disbanded_title')}
        </span>
        <span className="text-sm text-lavender flex items-center gap-1.5">
          {t('guild_disbanded_message')}
          <Heart size={14} className="text-coral shrink-0" weight="fill" />
        </span>
      </div>
    </div>
  )
}

export default GuildDisbandedBanner
