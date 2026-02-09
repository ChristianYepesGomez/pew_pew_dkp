import CatLogo from '../Layout/CatLogo'

const AuthFormHeader = ({ title, description, logoSize = 116, logoVariant = 'default' }) => {
  return (
    <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4">
      <div className="space-y-2 text-center md:text-left md:max-w-[65%]">
        <h2 className="text-xl font-bold text-coral leading-tight">{title}</h2>
        <p className="text-lavender text-xs leading-5">{description}</p>
      </div>

      <CatLogo size={logoSize} variant={logoVariant} className="mx-auto md:mx-0 shrink-0" />
    </div>
  )
}

export default AuthFormHeader
