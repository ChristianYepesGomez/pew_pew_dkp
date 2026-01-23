# DKP System - Frontend (React + Vite)

Frontend moderno para el sistema DKP de WoW, construido con React, Vite y Tailwind CSS.

## 🎨 Características

- ⚡ **Vite** - Build tool ultrarrápido
- ⚛️ **React 18** - UI library moderna
- 🎨 **Tailwind CSS** - Estilos utility-first
- 🌐 **Multi-idioma** - Soporte para Español e Inglés
- 🔒 **Autenticación JWT** - Sistema de login seguro
- 🔌 **Socket.IO** - Actualizaciones en tiempo real
- 📱 **Responsive** - Diseño adaptable a todos los dispositivos
- 🌙 **Midnight Theme** - Tema oscuro con efectos visuales

---

## 📦 Instalación

### 1. Instalar dependencias

```bash
cd frontend
npm install
```

### 2. Configurar variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```bash
cp .env.example .env
```

Edita `.env` con la configuración de tu backend:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
```

### 3. Iniciar servidor de desarrollo

```bash
npm run dev
```

El frontend estará disponible en: [http://localhost:5173](http://localhost:5173)

---

## 🏗️ Estructura del Proyecto

```
frontend/
├── src/
│   ├── components/          # Componentes reutilizables
│   │   ├── Layout/          # Header, Footer, Navigation
│   │   ├── Auth/            # Login, Register
│   │   ├── Roster/          # MembersTab
│   │   ├── DKP/             # CharacterTab
│   │   ├── Auction/         # AuctionTab, HistoryTab
│   │   └── Admin/           # AdminTab
│   ├── pages/               # Páginas principales
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── Dashboard.jsx
│   ├── hooks/               # Custom hooks
│   │   ├── useAuth.js
│   │   ├── useSocket.js
│   │   └── useLanguage.js
│   ├── context/             # Context providers
│   │   ├── AuthContext.jsx
│   │   ├── SocketContext.jsx
│   │   └── LanguageContext.jsx
│   ├── services/            # API y Socket.IO
│   │   ├── api.js
│   │   └── socket.js
│   ├── utils/               # Utilidades
│   │   └── translations.js
│   ├── App.jsx              # Componente principal
│   ├── main.jsx             # Entry point
│   └── index.css            # Estilos globales
├── public/                  # Archivos estáticos
├── index.html               # HTML principal
├── vite.config.js           # Configuración de Vite
├── tailwind.config.js       # Configuración de Tailwind
└── package.json             # Dependencias
```

---

## 🚀 Scripts Disponibles

```bash
# Desarrollo
npm run dev         # Inicia servidor de desarrollo (puerto 5173)

# Producción
npm run build       # Genera build de producción
npm run preview     # Preview del build de producción

# Linting
npm run lint        # Ejecuta ESLint
```

---

## 🔐 Autenticación

El frontend usa JWT (JSON Web Tokens) para autenticación:

1. **Login**: El usuario ingresa credenciales en `/login`
2. **Token**: El backend devuelve un token JWT
3. **Storage**: El token se guarda en `localStorage`
4. **Authorization**: Todas las peticiones incluyen el header `Authorization: Bearer <token>`
5. **Auto-logout**: Si el token expira (401), se redirige al login automáticamente

---

## 🌐 Sistema Multi-idioma

El frontend soporta español e inglés:

```jsx
import { useLanguage } from './hooks/useLanguage'

function MyComponent() {
  const { t, language, changeLanguage } = useLanguage()

  return (
    <div>
      <h1>{t('guild_name')}</h1>
      <button onClick={() => changeLanguage('en')}>English</button>
    </div>
  )
}
```

Las traducciones están en: `src/utils/translations.js`

---

## 📡 Socket.IO - Tiempo Real

El frontend se conecta al backend via Socket.IO para actualizaciones en tiempo real:

```jsx
import { useSocket } from './hooks/useSocket'

function MyComponent() {
  const { socket, connected } = useSocket({
    dkp_updated: (data) => {
      console.log('DKP actualizado:', data)
      // Actualizar UI
    },
    auction_started: (auction) => {
      alert(`Nueva subasta: ${auction.item_name}`)
    }
  })

  return <div>Conectado: {connected ? 'Sí' : 'No'}</div>
}
```

### Eventos disponibles:

- `dkp_updated` - DKP individual actualizado
- `dkp_bulk_updated` - DKP masivo actualizado
- `dkp_decay_applied` - Decay aplicado
- `auction_started` - Nueva subasta creada
- `bid_placed` - Nueva puja realizada
- `auction_ended` - Subasta finalizada
- `auction_cancelled` - Subasta cancelada
- `member_updated` - Miembro actualizado
- `member_removed` - Miembro eliminado

---

## 🎨 Tema y Estilos

### Midnight Theme

El frontend usa un tema oscuro personalizado con:
- Gradientes morados/azules
- Efectos de nebulosa y estrellas animadas
- Colores de clase WoW fieles al juego
- Sombras y resplandores (glow effects)

### Colores de Clase WoW

```css
.class-warrior   { color: #C79C6E; }
.class-paladin   { color: #F58CBA; }
.class-hunter    { color: #ABD473; }
.class-rogue     { color: #FFF569; }
.class-priest    { color: #FFFFFF; }
.class-shaman    { color: #0070DE; }
.class-mage      { color: #69CCF0; }
.class-warlock   { color: #9482C9; }
.class-druid     { color: #FF7D0A; }
.class-death-knight { color: #C41E3A; }
```

### Tailwind Customization

Los colores personalizados están en `tailwind.config.js`:

```js
colors: {
  midnight: {
    deepblue: '#0a0e27',
    spaceblue: '#1a1d3a',
    purple: '#4a1a8f',
    'bright-purple': '#8b5cf6',
    glow: '#a78bfa',
  },
  wow: { /* ... */ },
  rarity: { /* ... */ }
}
```

---

## 📱 Páginas Principales

### 1. Login (`/login`)
- Formulario de inicio de sesión
- Selector de idioma
- Link a registro

### 2. Register (`/register`)
- Formulario de registro con:
  - Username y password
  - Nombre del personaje
  - Clase (Warrior, Mage, etc.)
  - Rol de raid (Tank, Healer, DPS)
  - Especialización

### 3. Dashboard (`/`)
Sistema de pestañas con:

#### **Mi Personaje**
- Información del personaje (nombre, clase, rol)
- DKP actual (badge animado)
- Estadísticas (ganado, gastado, último decay)
- Historial de transacciones DKP

#### **Miembros**
- Tabla completa de miembros del guild
- Colores de clase WoW
- DKP de cada miembro
- Botones de ajuste rápido (+1, -1, custom) [Admin/Officer]

#### **Subasta Activa**
- Ver subasta activa
- Pujar en tiempo real
- Crear nueva subasta [Admin/Officer]
- Finalizar/Cancelar subasta [Admin/Officer]

#### **Historial de Subastas**
- Lista de subastas pasadas
- Ganadores y pujas ganadoras
- Estado (completada/cancelada)

#### **Admin** [Solo Admin/Officer]
- **Ajuste Masivo DKP**: Aplicar DKP a todos los miembros
- **Warcraft Logs**: Importar asistencia desde WCL
  - Preview de participantes
  - Matching automático con base de datos
  - Confirmación antes de aplicar DKP

---

## 🔧 Configuración Avanzada

### Proxy API (Vite)

El proxy está configurado en `vite.config.js` para evitar CORS en desarrollo:

```js
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    }
  }
}
```

### ESLint

Configuración en `.eslintrc.js` con reglas para React.

---

## 🐛 Debugging

### DevTools Recomendadas

1. **React DevTools** - Para inspeccionar componentes
2. **Redux DevTools** - Si usas Redux (actualmente Context API)
3. **Network Tab** - Para ver peticiones API y WebSocket

### Logs Útiles

El frontend hace logs de eventos importantes:

```
✅ Conectado a Socket.IO
💰 DKP actualizado: { userId: 1, newDkp: 150 }
🎉 Nueva subasta: Thunderfury
💵 Nueva puja: 250 DKP
```

---

## 🚀 Deploy a Producción

### Vercel (Recomendado)

```bash
# 1. Instalar Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel --prod
```

### Variables de entorno en Vercel

En el dashboard de Vercel, configura:
- `VITE_API_URL` = https://tu-backend.onrender.com/api
- `VITE_SOCKET_URL` = https://tu-backend.onrender.com

### Build Manual

```bash
npm run build
# Los archivos estarán en ./dist/
```

Luego sube la carpeta `dist/` a cualquier hosting estático (Netlify, GitHub Pages, etc.)

---

## 📚 Recursos

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Socket.IO Client](https://socket.io/docs/v4/client-api/)
- [Axios](https://axios-http.com/)

---

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'feat: agregar nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

---

## 📝 Notas Adicionales

### Compatibilidad de Navegadores

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Performance

- Lazy loading de componentes
- Code splitting automático (Vite)
- Optimización de imágenes
- CSS purgado en producción (Tailwind)

---

**Desarrollado con ❤️ para Pew Pew Kittens with Guns**

*Midnight Edition*
