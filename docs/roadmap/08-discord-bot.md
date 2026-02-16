# Brief 08: Discord Bot

## Prioridad: S-TIER (Game changer para adopcion)
## Esfuerzo estimado: 1-2 semanas
## Fase: Product-Ready

---

## Contexto
Discord es donde viven los guilds de WoW. Sin presencia en Discord, tu herramienta requiere que los usuarios abran el navegador activamente. Un bot reduce friccion dramaticamente: los raiders consultan DKP, reciben notificaciones de subastas, y confirman asistencia sin salir de Discord.

Ningun competidor de DKP tiene bot de Discord integrado con WarcraftLogs + subastas en tiempo real. Este es tu mayor diferenciador potencial.

---

## Arquitectura Propuesta

### Opcion A: Bot como modulo del backend (recomendada para MVP)
```
dkp-backend/
  bot/
    index.js          - Discord.js client init
    commands/          - Slash commands
    events/            - Discord event handlers
    embeds/            - Rich embed builders
```
- El bot vive en el mismo proceso que el backend
- Acceso directo a la DB y servicios existentes
- Simple de deployear (un solo proceso)
- Limitacion: no escala a muchos guilds (un bot instance per guild)

### Opcion B: Bot como servicio separado (para producto)
```
dkp-discord-bot/     - Proyecto separado
  src/
    commands/
    events/
    api-client.js    - Consume el API REST del backend
```
- Bot como servicio independiente
- Consume la API del backend via HTTP
- Escala independientemente
- Puede hostear un solo bot para multiples guilds

**Recomendacion**: Empezar con Opcion A para MVP, migrar a B cuando se necesite multi-guild.

---

## Slash Commands (MVP)

### Informacion
| Command | Descripcion | Permisos |
|---------|-------------|----------|
| `/dkp` | Ver tu DKP actual | Todos |
| `/dkp @usuario` | Ver DKP de otro | Todos |
| `/dkp leaderboard` | Top 10 DKP | Todos |
| `/bis` | Ver tu BIS list | Todos |
| `/attendance` | Tu % de asistencia (ultimo mes) | Todos |

### Subastas
| Command | Descripcion | Permisos |
|---------|-------------|----------|
| `/auction list` | Ver subastas activas | Todos |
| `/auction bid [id] [amount]` | Pujar en una subasta | Todos |
| `/auction create [item] [duration]` | Crear subasta | Officer+ |
| `/auction end [id]` | Cerrar subasta | Officer+ |

### Calendario
| Command | Descripcion | Permisos |
|---------|-------------|----------|
| `/signup [date] [status]` | Confirmar/declinar asistencia | Todos |
| `/calendar` | Ver raids de esta semana | Todos |

### Admin
| Command | Descripcion | Permisos |
|---------|-------------|----------|
| `/dkp adjust @usuario [amount] [reason]` | Ajustar DKP | Admin |
| `/import [wcl-link]` | Importar log de WCL | Admin |

---

## Notificaciones Automaticas (Canal configurado)

### Canal #dkp-auctions
- Nueva subasta creada (embed con item icon, duracion, min bid)
- Nuevo bid (quien, cuanto, tiempo restante)
- Subasta finalizada (ganador, precio, item)
- Anti-snipe triggered (extension de tiempo)

### Canal #raid-schedule
- Recordatorio de raid (configurable: 2h, 1h, 30min antes)
- Resumen de signups (quien confirmo, quien falta)
- Log importado (resumen: kills, wipes, DKP awarded)

### Canal #dkp-log
- DKP adjustments (bulk y single)
- DKP decay aplicado
- Nuevos miembros

### DM Privados
- Te superaron en una subasta (outbid notification)
- Ganaste una subasta
- Tu DKP fue ajustado
- Recordatorio de raid (si no has confirmado)

---

## Rich Embeds

### Auction Embed
```
🗡️ [Epic] Signet of the Priory
━━━━━━━━━━━━━━━━━━━━
Current Bid: 150 DKP by Thraxon
Time Left: 2m 34s
BIS Priority: 3 raiders want this
━━━━━━━━━━━━━━━━━━━━
[Bid Now] [View on Web]
```

### DKP Leaderboard Embed
```
🏆 DKP Leaderboard
━━━━━━━━━━━━━━━━━━━━
1. Thraxon (Warrior) — 320 DKP
2. Aeloria (Priest) — 285 DKP
3. Zulgrim (Warlock) — 260 DKP
...
━━━━━━━━━━━━━━━━━━━━
Your rank: #7 (180 DKP)
```

---

## Dependencias
- `discord.js` v14+ (slash commands, embeds, buttons, modals)
- Backend API endpoints ya existen para todo lo necesario
- Necesita: Discord Application + Bot Token (developer portal)

## Vinculacion de Cuentas
- **Problema**: Como saber que usuario de Discord es que usuario del DKP system?
- **Solucion**: `/link [username]` command que genera codigo temporal, usuario lo ingresa en la web
- **Alternativa**: Almacenar `discord_id` en tabla `users`, vincular via OAuth o comando

## Tareas de Implementacion

### Fase 1: Setup (dia 1)
1. Crear Discord Application en developer portal
2. Setup discord.js client en `bot/index.js`
3. Registrar slash commands
4. Vincular startup con `server.js` (o como proceso separado)

### Fase 2: Read Commands (dias 2-3)
1. `/dkp`, `/dkp @user`, `/dkp leaderboard`
2. `/auction list`
3. `/calendar`
4. `/attendance`
5. Rich embeds con colores de clase WoW

### Fase 3: Write Commands (dias 4-5)
1. `/auction bid`
2. `/signup`
3. Account linking (`/link`)
4. Permission checks (Discord roles → app roles)

### Fase 4: Notifications (dias 6-7)
1. Auction events → Discord channel
2. Raid reminders
3. DKP change notifications
4. Outbid DMs

### Fase 5: Admin (dias 8-9)
1. `/dkp adjust`
2. `/auction create` y `/auction end`
3. `/import` (WCL link)
4. Configuration commands (set channels)

---

## Archivos a crear
- `bot/index.js` — Client init, event registration
- `bot/commands/*.js` — Un archivo por comando
- `bot/events/*.js` — Event handlers (messageCreate, interactionCreate)
- `bot/embeds/*.js` — Embed builders
- `bot/utils/linking.js` — Account linking logic
- Modificar: `database.js` — agregar `discord_id` a users, tabla `bot_config`
- Modificar: `server.js` — iniciar bot al startup (o separado)

## Verificacion
- [ ] Bot online en Discord server de la guild
- [ ] `/dkp` muestra DKP correctamente
- [ ] `/auction list` muestra subastas activas con embeds
- [ ] `/auction bid` funciona y emite evento Socket.IO al web
- [ ] Notificaciones automaticas en canales configurados
- [ ] Account linking funcional
- [ ] Permisos: solo officers pueden crear/cerrar subastas
- [ ] Outbid DM enviado al superado
