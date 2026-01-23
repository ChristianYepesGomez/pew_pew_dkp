# 🎮 Guild DKP System - Backend

Sistema de gestión de Dragon Kill Points (DKP) para guilds de World of Warcraft.

> **📝 Nota sobre Frontend**: Este repositorio contiene el backend del sistema DKP.
> Existe un **frontend provisional** disponible en la rama `frontend-provisional` que incluye
> una interfaz funcional con React + Vite. El equipo de frontend está desarrollando
> una versión definitiva de manera independiente.
>
> Para ver el frontend provisional: `git checkout frontend-provisional`

## ✨ Características

- **Autenticación JWT** - Login seguro con roles (admin, officer, raider)
- **Gestión de DKP** - Ajustes individuales y masivos
- **Sistema de Subastas** - Pujas en tiempo real con WebSockets
- **Decay de DKP** - Sistema configurable de decaimiento
- **Historial completo** - Registro de todas las transacciones
- **Importación CSV** - Carga masiva de roster
- **Tiempo real** - Actualizaciones instantáneas via Socket.IO

## 🚀 Instalación

### Requisitos
- Node.js 18+
- npm o yarn

### Pasos

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env y cambia JWT_SECRET

# 3. Iniciar servidor
npm start

# Para desarrollo con auto-reload:
npm run dev
```

El servidor iniciará en `http://localhost:3000`

**Usuario admin por defecto:**
- Username: `admin`
- Password: `admin123`

⚠️ **IMPORTANTE**: Cambia la contraseña del admin inmediatamente en producción.

## 📡 API Endpoints

### Autenticación

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/auth/register` | Registrar usuario | Público |
| POST | `/api/auth/login` | Iniciar sesión | Público |
| GET | `/api/auth/me` | Info usuario actual | Auth |

### Miembros

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| GET | `/api/members` | Listar todos los miembros | Auth |
| PUT | `/api/members/:id/role` | Cambiar rol de usuario | Admin |
| DELETE | `/api/members/:id` | Desactivar miembro | Admin |

### DKP

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/dkp/adjust` | Ajustar DKP individual | Officer+ |
| POST | `/api/dkp/bulk-adjust` | Ajustar DKP masivo | Officer+ |
| POST | `/api/dkp/decay` | Aplicar decay | Admin |
| GET | `/api/dkp/history/:userId` | Historial de DKP | Auth |

### Subastas

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| GET | `/api/auctions/active` | Subasta activa | Auth |
| POST | `/api/auctions` | Crear subasta | Officer+ |
| POST | `/api/auctions/:id/bid` | Pujar | Auth |
| POST | `/api/auctions/:id/end` | Finalizar subasta | Officer+ |
| POST | `/api/auctions/:id/cancel` | Cancelar subasta | Officer+ |
| GET | `/api/auctions/history` | Historial subastas | Auth |

### Raids

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/raids` | Crear evento raid | Officer+ |
| POST | `/api/raids/:id/attendance` | Registrar asistencia | Officer+ |

### Importación

| Método | Endpoint | Descripción | Rol |
|--------|----------|-------------|-----|
| POST | `/api/import/roster` | Importar roster CSV | Admin |

## 🔌 WebSocket Events

### Eventos del Servidor → Cliente

```javascript
// Conectar
const socket = io('http://localhost:3000');

// Escuchar eventos
socket.on('dkp_updated', ({ userId, newDkp, amount }) => {
  // Actualizar UI
});

socket.on('auction_started', (auction) => {
  // Mostrar nueva subasta
});

socket.on('bid_placed', ({ auctionId, userId, characterName, amount }) => {
  // Actualizar pujas
});

socket.on('auction_ended', ({ auctionId, winner }) => {
  // Mostrar ganador
});
```

## 📊 Estructura de Base de Datos

```
users
├── id
├── username
├── password (hashed)
├── character_name
├── character_class
├── raid_role (Tank/Healer/DPS)
├── role (admin/officer/raider)
└── is_active

member_dkp
├── user_id
├── current_dkp
├── lifetime_gained
├── lifetime_spent
└── last_decay_at

auctions
├── id
├── item_name
├── item_image
├── item_rarity
├── min_bid
├── status
├── winner_id
└── winning_bid

auction_bids
├── auction_id
├── user_id
└── amount

dkp_transactions
├── user_id
├── amount
├── reason
├── performed_by
└── created_at
```

## ⏰ Tareas Programadas

El sistema incluye scripts para tareas periódicas:

```bash
# Aplicar 10% de decay semanal
node tasks/scheduled.js decay 10

# Limpiar transacciones de más de 90 días
node tasks/scheduled.js cleanup 90

# Generar reporte semanal
node tasks/scheduled.js report

# Ver miembros inactivos (30+ días sin raids)
node tasks/scheduled.js inactive 30
```

### Configurar Cron Jobs

```bash
# Decay semanal los lunes a las 00:00
0 0 * * 1 cd /path/to/dkp-backend && node tasks/scheduled.js decay 10

# Limpieza mensual
0 0 1 * * cd /path/to/dkp-backend && node tasks/scheduled.js cleanup 90
```

## 📝 Ejemplo: Importar Roster desde CSV

Formato esperado del CSV:
```csv
characterName,characterClass,raidRole,dkp
Thrallbane,Warrior,Tank,450
Elyndra,Priest,Healer,380
Shadowmeld,Rogue,DPS,320
```

Request:
```javascript
POST /api/import/roster
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "members": [
    { "characterName": "Thrallbane", "characterClass": "Warrior", "raidRole": "Tank", "dkp": 450 },
    { "characterName": "Elyndra", "characterClass": "Priest", "raidRole": "Healer", "dkp": 380 }
  ]
}
```

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt (10 rounds)
- JWT con expiración de 7 días
- Validación de roles en cada endpoint
- Sanitización de inputs
- CORS configurado

### Producción

1. Cambia `JWT_SECRET` a una clave segura:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. Usa HTTPS (nginx/caddy como reverse proxy)

3. Configura rate limiting

4. Activa backups de la base de datos

## 📁 Estructura del Proyecto

```
dkp-backend/
├── server.js           # Entry point, rutas principales
├── database.js         # Configuración SQLite
├── package.json
├── .env.example
├── middleware/
│   └── auth.js         # JWT y autorización
├── utils/
│   └── validation.js   # Validadores
├── tasks/
│   └── scheduled.js    # Tareas programadas
└── data/
    └── dkp.db          # Base de datos (auto-creada)
```

## 🤝 Próximos Pasos

- [ ] Integración con Wowhead para imágenes de items
- [ ] Sistema de loot council alternativo
- [ ] Notificaciones por Discord webhook
- [ ] Estadísticas y gráficos
- [ ] Soporte multi-guild

---

**For the Horde! ⚔️ For the Alliance!**
