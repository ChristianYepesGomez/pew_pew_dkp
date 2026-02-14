# Brief 10: Loot Council & EPGP Modes

## Prioridad: MEDIA-ALTA (expande mercado 3-4x)
## Esfuerzo estimado: 2-3 semanas
## Fase: Market Expansion

---

## Contexto
DKP es usado por 15-25% de guilds. Loot Council es el dominante (60-70%). EPGP ocupa 5-10%. Soportar los tres sistemas multiplica tu mercado potencial por 3-4x.

La clave es que la infraestructura base (roster, calendar, raids, WCL import, analytics) es compartida. Solo el modulo de distribucion de loot cambia.

---

## Arquitectura: Loot System Abstraction

### Core Concept
```javascript
// lib/lootSystems/index.js
export function getLootSystem(guildConfig) {
    switch (guildConfig.loot_system) {
        case 'dkp': return new DKPSystem(guildConfig);
        case 'epgp': return new EPGPSystem(guildConfig);
        case 'loot_council': return new LootCouncilSystem(guildConfig);
        default: return new DKPSystem(guildConfig);
    }
}

// Interface comun:
class LootSystem {
    async getPlayerPriority(userId) {}
    async awardItem(itemId, userId, context) {}
    async getLeaderboard() {}
    async applyDecay(percentage) {}
    async getHistory(userId) {}
}
```

---

## Sistema 1: Loot Council Mode

### Como funciona
1. Item droppea en raid (o se importa via WCL)
2. Officers crean una "loot decision" para el item
3. Raiders expresan interes: "BIS", "upgrade", "minor", "offspec", "pass"
4. Officers votan (thumbs up/down per candidate)
5. Loot master asigna el item al ganador
6. Se registra la decision con razon

### Tablas nuevas
```sql
CREATE TABLE loot_decisions (
    id INTEGER PRIMARY KEY,
    item_id INTEGER NOT NULL,
    item_name TEXT,
    raid_id INTEGER,
    boss_name TEXT,
    status TEXT DEFAULT 'open',  -- open, decided, cancelled
    winner_id INTEGER,
    decided_by INTEGER,
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    decided_at TEXT
);

CREATE TABLE loot_responses (
    id INTEGER PRIMARY KEY,
    decision_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    response TEXT NOT NULL,      -- bis, upgrade, minor, offspec, pass
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (decision_id) REFERENCES loot_decisions(id)
);

CREATE TABLE loot_votes (
    id INTEGER PRIMARY KEY,
    decision_id INTEGER NOT NULL,
    voter_id INTEGER NOT NULL,   -- officer voting
    candidate_id INTEGER NOT NULL, -- player being voted for
    vote TEXT NOT NULL,           -- approve, reject
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (decision_id) REFERENCES loot_decisions(id)
);
```

### Endpoints nuevos
```
POST   /api/loot-council/decisions           -- crear decision
GET    /api/loot-council/decisions/active     -- decisiones abiertas
POST   /api/loot-council/decisions/:id/respond -- raider expresa interes
POST   /api/loot-council/decisions/:id/vote   -- officer vota
POST   /api/loot-council/decisions/:id/award  -- asignar item
GET    /api/loot-council/history              -- historial
```

### UX
- Dashboard tab "Loot" reemplaza "Auctions" cuando loot_system = loot_council
- Item droppea → modal con candidatos que respondieron → officers votan → assign
- Historial muestra quien recibio que y por que razon
- Transparencia: raiders ven votos de officers (configurable)

### Real-time
- Socket.IO: `loot_decision_created`, `loot_response`, `loot_voted`, `loot_awarded`
- Discord bot: Notifica nueva decision, pide respuestas, anuncia ganador

---

## Sistema 2: EPGP Mode

### Como funciona
- **EP (Effort Points)**: Se ganan por asistencia, kills, tiempo en raid
- **GP (Gear Points)**: Se gastan al recibir loot (valor depende del item)
- **Priority = EP / GP**: Ratio determina quien tiene prioridad
- **Decay**: Ambos EP y GP decaen semanalmente (tipicamente 10-20%)

### Diferencias con DKP
| Aspecto | DKP | EPGP |
|---------|-----|------|
| Moneda | Una (DKP) | Dos (EP + GP) |
| Prioridad | DKP balance | EP/GP ratio |
| Loot cost | Auction bid | Fijo por item tier |
| Inflation | Puede inflarse | Decay lo controla |
| Complejidad | Simple | Media |

### Tablas nuevas/modificadas
```sql
-- Extender member_dkp o crear nueva tabla
CREATE TABLE member_epgp (
    user_id INTEGER PRIMARY KEY,
    effort_points REAL DEFAULT 0,
    gear_points REAL DEFAULT 0,
    -- priority = EP / max(GP, 1) -- calculado, no almacenado
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE epgp_transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,          -- ep_gain, gp_spend, decay
    ep_change REAL DEFAULT 0,
    gp_change REAL DEFAULT 0,
    reason TEXT,
    item_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE epgp_item_values (
    id INTEGER PRIMARY KEY,
    item_id INTEGER,
    item_quality TEXT,           -- epic, rare, legendary
    slot_type TEXT,              -- head, chest, weapon, trinket
    gp_value INTEGER NOT NULL,   -- GP cost for this item tier
    -- Typical: weapon=100, tier=80, trinket=75, other=60
);
```

### Endpoints nuevos
```
GET    /api/epgp/standings           -- leaderboard by EP/GP ratio
POST   /api/epgp/ep/award            -- award EP (attendance, kill)
POST   /api/epgp/gp/charge           -- charge GP (item received)
POST   /api/epgp/decay               -- apply % decay to both
GET    /api/epgp/history/:userId      -- transaction history
GET    /api/epgp/item-values          -- GP values table
PUT    /api/epgp/item-values/:id      -- update GP value
```

### Auto-calculation
- Import WCL → auto-award EP por kill/attendance
- Item asignado → auto-charge GP basado en item tier/slot
- Weekly decay via cron job (scheduler)

---

## Implementacion Strategy

### Fase 1: Abstraccion (3-4 dias)
1. Crear `lib/lootSystems/` con interface base
2. Mover logica DKP actual a `lib/lootSystems/dkp.js`
3. Agregar `loot_system` a guild config
4. Dashboard muestra UI segun loot_system configurado

### Fase 2: Loot Council (5-7 dias)
1. Schema + migrations
2. Endpoints
3. Real-time events
4. Frontend tab
5. Discord bot commands

### Fase 3: EPGP (5-7 dias)
1. Schema + migrations
2. Endpoints
3. Auto EP/GP from WCL imports
4. Decay scheduler
5. Frontend tab
6. Discord bot commands

### Fase 4: System Switching (2-3 dias)
1. Admin puede cambiar loot system
2. Data migration helper (DKP → EPGP conversion, etc)
3. Onboarding pregunta que sistema usar

---

## Notas

### No over-engineer
- Empieza con DKP (ya funciona) + Loot Council (mercado grande)
- EPGP puede esperar — es el mercado mas pequeno
- La abstraccion debe ser simple — no necesitas un plugin system

### Mantener auctions como opcion
- Auctions son feature unica tuya — no las pierdas
- Loot Council guilds pueden querer "auction para BOEs" o "auction para offspec"
- Configurable: "primary system: Loot Council, secondary: DKP Auction for offspec"

---

## Archivos a crear
- `lib/lootSystems/index.js` — factory + interface
- `lib/lootSystems/dkp.js` — actual logic extracted
- `lib/lootSystems/lootCouncil.js`
- `lib/lootSystems/epgp.js`
- `routes/lootCouncil.js`
- `routes/epgp.js`
- Frontend: `LootCouncilTab.jsx`, `EPGPTab.jsx`

## Verificacion
- [ ] Guild puede configurar loot_system: dkp | loot_council | epgp
- [ ] Dashboard muestra UI correcta segun sistema
- [ ] Loot Council: crear decision → responder → votar → award funciona end-to-end
- [ ] EPGP: EP award + GP charge + decay + leaderboard funciona
- [ ] WCL import respeta el loot system configurado
- [ ] Auctions disponibles como secundario en cualquier modo
