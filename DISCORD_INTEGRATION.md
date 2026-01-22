# 🤖 Integración Discord Bot - Sistema DKP

## 📋 Resumen

El bot de Discord permitirá a los miembros de la guild interactuar con el sistema DKP directamente desde Discord, facilitando la gestión sin necesidad de abrir el navegador.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DISCORD                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Discord    │         │  Discord Bot │                 │
│  │   Server     │◄────────┤  (Node.js)   │                 │
│  │              │         │              │                 │
│  │  #dkp-bot    │         │  discord.js  │                 │
│  │  #subastas   │         │              │                 │
│  └──────────────┘         └──────┬───────┘                 │
│                                  │                          │
│                                  │ HTTP + WebSocket         │
│                                  ▼                          │
│                         ┌─────────────────┐                 │
│                         │  DKP Backend    │                 │
│                         │  (Express API)  │                 │
│                         │  localhost:3000 │                 │
│                         └─────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Funcionalidades del Bot

### Para Todos los Usuarios (Raiders)

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/dkp` | Ver tu DKP actual | `/dkp` |
| `/dkp @usuario` | Ver DKP de otro usuario | `/dkp @Testador` |
| `/roster` | Ver lista completa con DKP | `/roster` |
| `/historial` | Ver tu historial de DKP | `/historial` |
| `/subastaactiva` | Ver subasta actual | `/subastaactiva` |
| `/pujar [cantidad]` | Pujar en subasta activa | `/pujar 150` |

### Para Officers

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/ajustar @user [+/-cantidad] [razón]` | Ajustar DKP individual | `/ajustar @Testador +50 Boss kill` |
| `/ajustarmasivo [+/-cantidad] [razón]` | Ajustar DKP a todos | `/ajustarmasivo +30 Raid completada` |
| `/crearsubasta [item] [puja mínima]` | Crear nueva subasta | `/crearsubasta Thunderfury 100` |
| `/cerrarsubasta` | Finalizar subasta actual | `/cerrarsubasta` |
| `/cancelarsubasta` | Cancelar subasta | `/cancelarsubasta` |

### Para Admins

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/decay [porcentaje]` | Aplicar decay a todo el roster | `/decay 10` |
| `/cambiarrol @user [rol]` | Cambiar rol de usuario | `/cambiarrol @Testador officer` |
| `/eliminar @user` | Desactivar miembro | `/eliminar @Inactivo` |

---

## 🔔 Notificaciones Automáticas

El bot enviará mensajes automáticos en canales específicos:

### Canal `#subastas`
- 🔔 Nueva subasta iniciada
- 💰 Nueva puja realizada
- 🏆 Subasta finalizada con ganador
- ❌ Subasta cancelada

### Canal `#dkp-general`
- ✅ DKP ajustado (masivo)
- 📉 Decay aplicado
- 🎖️ Cambios de rol

---

## 🔐 Sistema de Permisos

El bot verificará permisos de Discord y los mapearán al sistema DKP:

```javascript
Discord Role → DKP Role
─────────────────────────
Guild Master  → admin
Officers      → officer
Raiders       → raider
```

---

## 📡 Integración WebSocket

El bot se conectará al backend via WebSocket para recibir actualizaciones en tiempo real:

```javascript
// Eventos que el bot escucha del backend
socket.on('auction_started', (data) => {
  // Enviar mensaje a #subastas
});

socket.on('bid_placed', (data) => {
  // Actualizar mensaje de subasta
});

socket.on('auction_ended', (data) => {
  // Anunciar ganador
});

socket.on('dkp_bulk_updated', (data) => {
  // Notificar ajuste masivo
});
```

---

## 🛠️ Stack Tecnológico

- **Discord.js v14**: Librería para interactuar con Discord API
- **Socket.IO Client**: Para recibir eventos en tiempo real
- **Axios**: Para hacer requests HTTP al backend
- **Node.js 20+**: Runtime

---

## 📁 Estructura del Proyecto

```
dkp-discord-bot/
├── bot.js                  # Entry point del bot
├── package.json
├── .env                    # Discord token, API URL
├── commands/
│   ├── public/             # Comandos para raiders
│   │   ├── dkp.js
│   │   ├── roster.js
│   │   ├── historial.js
│   │   ├── subastaactiva.js
│   │   └── pujar.js
│   ├── officer/            # Comandos para officers
│   │   ├── ajustar.js
│   │   ├── ajustarmasivo.js
│   │   ├── crearsubasta.js
│   │   └── cerrarsubasta.js
│   └── admin/              # Comandos para admins
│       ├── decay.js
│       ├── cambiarrol.js
│       └── eliminar.js
├── events/
│   ├── ready.js            # Bot conectado
│   ├── interactionCreate.js # Manejo de slash commands
│   └── messageCreate.js    # Comandos legacy (opcional)
├── services/
│   ├── api.js              # Cliente HTTP para backend
│   └── socket.js           # Cliente WebSocket
├── utils/
│   ├── embeds.js           # Crear embeds bonitos
│   ├── permissions.js      # Verificar permisos
│   └── formatters.js       # Formatear datos
└── config/
    └── channels.js         # IDs de canales de Discord
```

---

## 🔑 Variables de Entorno (.env)

```env
# Discord
DISCORD_TOKEN=your-bot-token-here
DISCORD_CLIENT_ID=your-client-id
DISCORD_GUILD_ID=your-server-id

# Canales
CHANNEL_SUBASTAS=123456789
CHANNEL_DKP_GENERAL=987654321

# Backend
API_URL=http://localhost:3000
API_SECRET=secret-para-autenticar-bot

# Roles de Discord (IDs)
ROLE_ADMIN=111111111
ROLE_OFFICER=222222222
ROLE_RAIDER=333333333
```

---

## 🚀 Flujo de Autenticación Bot ↔ Backend

Para que el bot pueda hacer requests al backend sin JWT de usuario:

### Opción 1: API Key (Recomendado)
```javascript
// El bot usa un API key especial
headers: {
  'X-Bot-Secret': process.env.API_SECRET
}

// Backend verifica el secret en un middleware
function authenticateBot(req, res, next) {
  const secret = req.headers['x-bot-secret'];
  if (secret === process.env.BOT_API_SECRET) {
    req.bot = true;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}
```

### Opción 2: Service Account
```javascript
// El bot tiene su propio usuario "system" con rol especial
// Login al iniciar y usar ese JWT
const botToken = await loginAsBot();
```

---

## 📊 Ejemplo de Embed para Subasta

```javascript
const auctionEmbed = {
  color: 0xFF8000, // Legendary orange
  title: '⚔️ Nueva Subasta Activa',
  description: '**Thunderfury, Blessed Blade of the Windseeker**',
  thumbnail: {
    url: 'https://wow.zamimg.com/images/wow/icons/large/inv_sword_39.jpg'
  },
  fields: [
    { name: '💰 Puja Mínima', value: '100 DKP', inline: true },
    { name: '🏆 Puja Actual', value: '150 DKP', inline: true },
    { name: '👤 Líder Actual', value: 'Testador (Mage)', inline: true },
    { name: '📊 Total Pujas', value: '3', inline: true }
  ],
  footer: {
    text: 'Usa /pujar [cantidad] para participar'
  },
  timestamp: new Date()
};
```

---

## 🎯 Próximos Pasos para Implementar

1. ✅ Backend verificado y funcionando
2. ⬜ Crear proyecto Discord bot
3. ⬜ Implementar comandos básicos (/dkp, /roster)
4. ⬜ Implementar sistema de subastas en Discord
5. ⬜ Conectar WebSocket para notificaciones
6. ⬜ Añadir middleware de autenticación para el bot en backend
7. ⬜ Deploy del bot (Render, Railway, o VPS)

---

## 🔒 Seguridad

- El bot NUNCA guardará contraseñas
- Usará Discord IDs para vincular usuarios
- Necesitará un sistema de vinculación: `/vincular [username]`
- Los comandos sensibles solo funcionarán en canales específicos
- Rate limiting para evitar spam

---

## 🎨 Diseño Visual

Los embeds usarán los colores de clase de WoW y rareza de items:
- **Legendary**: #FF8000 (naranja)
- **Epic**: #A335EE (morado)
- **Rare**: #0070DD (azul)

---

*Documentación de integración Discord - Sistema DKP*
*Última actualización: Enero 2025*
