# 🎮 DKP Frontend

Frontend React + Vite para el sistema de gestión de DKP.

## 🚀 Quick Start

### 1. Instalar Dependencias

```bash
npm install
```

### 2. Configurar Variables de Entorno

Asegúrate de que `.env` existe con:

```env
VITE_API_URL=http://localhost:3000
```

### 3. Iniciar Dev Server

```bash
npm run dev
```

El frontend estará disponible en: **http://localhost:5173**

## 📦 Build para Producción

```bash
npm run build
```

Los archivos estáticos se generan en `dist/`

## 🏗️ Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── Header.jsx
│   ├── TabNavigation.jsx
│   └── tabs/
│       ├── RosterTab.jsx
│       ├── AuctionsTab.jsx
│       ├── HistoryTab.jsx
│       └── AdminTab.jsx
├── pages/              # Páginas principales
│   ├── LoginPage.jsx
│   └── DashboardPage.jsx
├── services/           # API y servicios
│   └── api.js
├── hooks/              # Custom React hooks
│   └── useAuth.js
├── styles/             # CSS modules
│   ├── index.css       # Reset y base
│   ├── login.css       # Login page
│   ├── dashboard.css   # Dashboard layout
│   └── components.css  # Componentes
├── App.jsx
└── main.jsx
```

## 🎨 Diseño

- **Tema oscuro** inspirado en Raider.io
- **Colores de clase WoW** para personajes
- **Minimalista** y limpio
- **Responsive** (adaptable a móviles)

## 🔐 Credenciales por Defecto

```
Usuario: admin
Contraseña: admin123
```

⚠️ **IMPORTANTE**: Cambiar estas credenciales en producción.

## 📋 Funcionalidades

### Roster Tab
- Ver todos los miembros del roster
- DKP actual y lifetime de cada jugador
- Colores de clase WoW
- Badges de rol (Tank, Healer, DPS)

### Auctions Tab
- Ver auction activa
- Hacer bids en items
- Ver historial de bids

### History Tab
- Historial completo de transacciones DKP
- Filtrado por fecha
- Color coding (verde = ganancia, rojo = gasto)

### Admin Tab (Solo Admin/Officer)
- **Warcraft Logs**: Procesar logs y asignar DKP
  - Preview con matching de participantes
  - Detección de anomalías
  - Confirmación manual
- **Manual Adjustment**: Ajustar DKP manualmente
- **Configuration**: Modificar configuración de DKP
- **Recent Logs**: Ver historial de logs procesados

## 🔌 Conexión con Backend

El frontend se comunica con el backend en `http://localhost:3000` (configurable en `.env`).

### API Endpoints Usados

```javascript
// Auth
POST   /api/auth/login
GET    /api/auth/me

// Users
GET    /api/users

// DKP
GET    /api/dkp/history

// Auctions
GET    /api/auctions/active
POST   /api/auctions/:id/bid

// Warcraft Logs
GET    /api/warcraftlogs/config
PUT    /api/warcraftlogs/config
POST   /api/warcraftlogs/preview
POST   /api/warcraftlogs/confirm
GET    /api/warcraftlogs/history
```

## 🛠️ Tecnologías

- **React 18**: Framework UI
- **Vite**: Build tool y dev server
- **Axios**: Cliente HTTP
- **Socket.IO Client**: WebSockets (real-time updates)
- **CSS Puro**: Sin frameworks CSS

## 📝 Notas de Desarrollo

- El token JWT se guarda en `localStorage`
- El proxy de Vite redirige `/api/*` a `http://localhost:3000`
- WebSocket se conecta automáticamente al login (pendiente implementar)

## 🐛 Troubleshooting

### Error: "Cannot connect to backend"

1. Verifica que el backend esté corriendo:
   ```bash
   cd ../dkp-backend
   docker-compose up
   ```

2. Verifica que `VITE_API_URL` en `.env` sea correcto

### Error: "Token expired"

Hacer logout y login de nuevo. El token JWT dura 7 días.

### Error: "Module not found"

Reinstalar dependencias:
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📚 Documentación Adicional

Ver [`ARCHITECTURE_DECISIONS.md`](../ARCHITECTURE_DECISIONS.md) para decisiones arquitectónicas y guías de desarrollo.
