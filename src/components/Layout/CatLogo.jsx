const LOGO_SOURCES = {
  default: '/logo.svg',
  cat: '/logo-cat.svg',
}

const CatLogo = ({ size = 40, className = '', variant = 'default' }) => (
  <img
    src={LOGO_SOURCES[variant] || LOGO_SOURCES.default}
    alt="Pew Pew Kittens with Guns"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: 'contain' }}
  />
)

export default CatLogo
