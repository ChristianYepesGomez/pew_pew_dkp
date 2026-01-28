const CatLogo = ({ size = 40, className = '' }) => (
  <img
    src="/logo.png"
    alt="Pew Pew Kittens with Guns"
    width={size}
    height={size}
    className={className}
    style={{ objectFit: 'contain' }}
  />
)

export default CatLogo
