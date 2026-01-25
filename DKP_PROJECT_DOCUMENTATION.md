# 🎮 DKP System - Documentación Completa del Proyecto

## 📋 Resumen Ejecutivo

Este es un sistema de gestión de **Dragon Kill Points (DKP)** para guilds de World of Warcraft. DKP es un sistema de puntos que las guilds usan para distribuir el loot de manera justa: los jugadores acumulan puntos por asistir a raids y los gastan pujando por items.

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                      ARQUITECTURA GENERAL                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐            ┌──────────────────────────┐  │
│  │     FRONTEND     │            │        BACKEND           │  │
│  │                  │            │                          │  │
│  │  React + Vite    │◄──────────►│  Node.js + Express       │  │
│  │                  │   REST +   │  SQLite + Socket.IO      │  │
│  │  Tailwind CSS    │  WebSocket │                          │  │
│  │                  │            │  Puerto: 3000            │  │
│  │  Puerto: 5173    │            │                          │  │
│  └──────────────────┘            └──────────────────────────┘  │
│         │                                   │                   │
│         ▼                                   ▼                   │
│  ┌──────────────────┐            ┌──────────────────────────┐  │
│  │     Vercel       │            │      Render.com          │  │
│  │     (Gratis)     │            │      (Gratis)            │  │
│  └──────────────────┘            └──────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Funcionalidades Principales

### 1. Gestión de Roster (Lista de Miembros)
- Ver todos los miembros de la guild con sus DKP
- Ordenar por DKP, clase, rol
- Añadir/eliminar miembros
- Colores de clase fieles a WoW (Warrior marrón, Mage azul, etc.)

### 2. Sistema de DKP
- Ajustar DKP individual (+/- puntos)
- Ajustar DKP masivo (dar puntos a todos por asistencia)
- Sistema de decay (reducción periódica de DKP, ej: -10% semanal)
- Historial completo de transacciones

### 3. Sistema de Subastas
- Crear subasta para un item (con nombre, imagen, puja mínima)
- Los miembros pujan en tiempo real (WebSockets)
- Al cerrar la subasta, el ganador paga automáticamente
- Historial de subastas completadas

### 4. Autenticación y Roles
- **Admin**: Control total (decay, importar roster, eliminar usuarios)
- **Officer**: Gestionar DKP y subastas
- **Raider**: Ver roster, pujar en subastas

---

## 🗄️ Modelo de Base de Datos

```sql
-- Usuarios del sistema
users
├── id (PK)
├── username (único)
├── password (hasheado con bcrypt)
├── character_name
├── character_class (Warrior, Mage, Priest, etc.)
├── raid_role (Tank, Healer, DPS)
├── role (admin, officer, raider)
├── is_active
└── created_at

-- DKP de cada miembro (separado para optimizar updates)
member_dkp
├── id (PK)
├── user_id (FK → users)
├── current_dkp
├── lifetime_gained
├── lifetime_spent
└── last_decay_at

-- Log de todas las transacciones de DKP
dkp_transactions
├── id (PK)
├── user_id (FK → users)
├── amount (+/-)
├── reason
├── performed_by (FK → users)
└── created_at

-- Subastas
auctions
├── id (PK)
├── item_name
├── item_image
├── item_rarity (common, uncommon, rare, epic, legendary)
├── min_bid
├── status (active, completed, cancelled)
├── winner_id (FK → users)
├── winning_bid
├── created_by (FK → users)
└── created_at, ended_at

-- Pujas de cada subasta
auction_bids
├── id (PK)
├── auction_id (FK → auctions)
├── user_id (FK → users)
├── amount
└── created_at

-- Eventos de raid
raids
├── id (PK)
├── name
├── scheduled_at
├── dkp_reward
└── created_by (FK → users)

-- Asistencia a raids
raid_attendance
├── id (PK)
├── raid_id (FK → raids)
├── user_id (FK → users)
└── joined_at
```

---

## 🔌 API Endpoints

### Autenticación
| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/auth/register` | Registrar usuario | Público |
| POST | `/api/auth/login` | Login → devuelve JWT | Público |
| GET | `/api/auth/me` | Info del usuario actual | Auth |

### Miembros
| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| GET | `/api/members` | Listar todos (ordenados por DKP) | Auth |
| PUT | `/api/members/:id/role` | Cambiar rol | Admin |
| DELETE | `/api/members/:id` | Desactivar miembro | Admin |

### DKP
| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/dkp/adjust` | Ajustar DKP individual | Officer+ |
| POST | `/api/dkp/bulk-adjust` | Ajustar DKP masivo | Officer+ |
| POST | `/api/dkp/decay` | Aplicar decay % | Admin |
| GET | `/api/dkp/history/:userId` | Historial de un usuario | Auth |

### Subastas
| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| GET | `/api/auctions/active` | Subasta activa actual | Auth |
| POST | `/api/auctions` | Crear nueva subasta | Officer+ |
| POST | `/api/auctions/:id/bid` | Pujar | Auth |
| POST | `/api/auctions/:id/end` | Finalizar subasta | Officer+ |
| POST | `/api/auctions/:id/cancel` | Cancelar subasta | Officer+ |
| GET | `/api/auctions/history` | Historial de subastas | Auth |

### Health Check
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/health` | Estado del servidor |

---

## 📡 WebSocket Events

### Servidor → Cliente
```javascript
'dkp_updated'        → { userId, newDkp, amount }
'dkp_bulk_updated'   → { userIds, amount }
'dkp_decay_applied'  → { percentage }
'auction_started'    → { auction object }
'bid_placed'         → { auctionId, userId, characterName, characterClass, amount }
'auction_ended'      → { auctionId, itemName, winner: { userId, characterName, amount } }
'auction_cancelled'  → { auctionId }
'member_updated'     → { memberId }
'member_removed'     → { memberId }
```

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Base de datos**: SQLite (better-sqlite3)
- **WebSockets**: Socket.IO
- **Autenticación**: JWT (jsonwebtoken) + bcryptjs
- **Contenedor**: Docker

### Frontend (a desarrollar)
- **Framework**: React 18 + Vite
- **Estilos**: Tailwind CSS
- **Estado**: React Context o Zustand
- **WebSocket Client**: socket.io-client
- **HTTP Client**: Axios o fetch

### Despliegue
- **Backend**: Render.com (gratis, con Docker)
- **Frontend**: Vercel (gratis)
- **Base de datos**: SQLite con disco persistente en Render

---

## 🎨 Diseño Visual

### Paleta de Colores (Temática WoW/Fantasía)
```css
--background: #0a0a0f → #1a1a2e → #16213e (gradiente oscuro)
--gold: #d4af37 (principal, bordes, acentos)
--gold-light: #f4cf57
--gold-dark: #8b7355
--text: #e8d5b7 (texto principal)
--text-muted: #8b8b9b

/* Colores de clase WoW */
--warrior: #C79C6E
--paladin: #F58CBA
--hunter: #ABD473
--rogue: #FFF569
--priest: #FFFFFF
--shaman: #0070DE
--mage: #69CCF0
--warlock: #9482C9
--druid: #FF7D0A
--death-knight: #C41E3A

/* Rareza de items */
--common: #9d9d9d
--uncommon: #1eff00
--rare: #0070dd
--epic: #a335ee
--legendary: #ff8000
```

### Tipografía
- **Títulos**: Cinzel (serif, estilo medieval)
- **Cuerpo**: Crimson Text (serif legible)

---

## 📁 Estructura del Backend (ya creado)

```
dkp-backend/
├── server.js              # Entry point, todas las rutas
├── database.js            # Schema SQLite, inicialización
├── package.json
├── Dockerfile             # Imagen Docker optimizada
├── docker-compose.yml     # Desarrollo local
├── render.yaml            # Config para Render.com
├── middleware/
│   └── auth.js            # JWT + autorización por roles
├── utils/
│   └── validation.js      # Validadores (clases WoW, etc.)
├── tasks/
│   └── scheduled.js       # Decay, limpieza, reportes
└── data/
    └── dkp.db             # Base de datos (auto-creada)
```

---

## 📁 Estructura del Frontend (a crear)

```
dkp-frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── Header.jsx
│   │   │   ├── Navigation.jsx
│   │   │   └── Footer.jsx
│   │   ├── Auth/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── Roster/
│   │   │   ├── RosterTable.jsx
│   │   │   ├── MemberRow.jsx
│   │   │   └── AddMemberModal.jsx
│   │   ├── DKP/
│   │   │   ├── DKPAdjustment.jsx
│   │   │   └── DKPHistory.jsx
│   │   └── Auction/
│   │       ├── ActiveAuction.jsx
│   │       ├── BidForm.jsx
│   │       ├── CreateAuctionModal.jsx
│   │       └── AuctionHistory.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Roster.jsx
│   │   ├── Auction.jsx
│   │   └── History.jsx
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useSocket.js
│   │   └── useApi.js
│   ├── context/
│   │   ├── AuthContext.jsx
│   │   └── SocketContext.jsx
│   ├── services/
│   │   ├── api.js
│   │   └── socket.js
│   └── utils/
│       ├── classColors.js
│       └── formatters.js
├── package.json
├── vite.config.js
├── tailwind.config.js
└── Dockerfile
```

---

## 🔐 Usuario por Defecto

Al iniciar el backend por primera vez, se crea automáticamente:
- **Username**: `admin`
- **Password**: `admin123`
- **Rol**: `admin`

⚠️ **IMPORTANTE**: Cambiar esta contraseña en producción.

---

## 🚀 Comandos de Desarrollo

### Backend
```bash
cd dkp-backend
npm install
npm start              # Producción
npm run dev            # Desarrollo con auto-reload

# Docker
docker-compose up --build
docker-compose down
```

### Frontend (cuando se cree)
```bash
cd dkp-frontend
npm install
npm run dev            # http://localhost:5173
npm run build          # Build para producción
```

---

## 📝 Notas para Continuar el Desarrollo

### Para el chat de BACKEND:
- El backend está completo y funcional
- Falta probar todos los endpoints
- Considerar añadir: rate limiting, logs más detallados, tests

### Para el chat de FRONTEND:
- Conectar con backend en `http://localhost:3000`
- Implementar auth flow completo (login, logout, refresh)
- Socket.IO para actualizaciones en tiempo real
- Diseño responsive (mobile-first)
- Mantener la estética de fantasía/WoW

---

## 🎯 Prioridades de Implementación

1. ✅ Backend API REST
2. ✅ WebSockets para tiempo real
3. ✅ Docker + configuración de despliegue
4. ⬜ Frontend: Auth (login/register)
5. ⬜ Frontend: Roster con DKP
6. ⬜ Frontend: Sistema de subastas
7. ⬜ Frontend: Historial
8. ⬜ Testing
9. ⬜ Despliegue en producción

---

*Documento generado para el proyecto DKP System*
*Última actualización: Enero 2025*
