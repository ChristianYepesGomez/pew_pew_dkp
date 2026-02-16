# Brief 09: Multi-Tenancy & Product Architecture

## Prioridad: ALTA (si quieres producto)
## Esfuerzo estimado: 2-3 semanas
## Fase: Product Architecture

---

## Contexto
Actualmente el sistema es single-tenant: una instancia = un guild. Para ser producto, necesitas soportar multiples guilds en una sola instancia. Esta es la decision arquitectonica mas grande del roadmap.

---

## Estrategias de Multi-Tenancy

### Opcion A: Database-per-tenant (RECOMENDADA para Turso)
```
Turso tiene "database groups" — puedes crear una DB por guild
guild_123.db → All data for guild 123
guild_456.db → All data for guild 456
platform.db  → Users, guilds, subscriptions, billing
```

**Ventajas**:
- Aislamiento total de datos (un guild no puede ver datos de otro)
- Facil backup/delete/export per guild
- Performance predecible (una DB lenta no afecta otras)
- Turso cobra por storage, no por numero de DBs

**Desventajas**:
- Connection management mas complejo
- Migraciones deben aplicarse a todas las DBs
- Cross-guild queries imposibles (no necesarias para DKP)

### Opcion B: Schema-per-tenant (shared DB, guild_id column)
```
Una sola DB con guild_id en cada tabla:
SELECT * FROM auctions WHERE guild_id = ? AND status = 'active'
```

**Ventajas**:
- Simple de implementar
- Una sola DB que migrar

**Desventajas**:
- Riesgo de data leak (olvidar WHERE guild_id = ?)
- Performance degrada con muchos guilds
- Mas dificil exportar/borrar datos de un guild

### Opcion C: Instance-per-tenant (Docker)
```
Cada guild tiene su propia instancia deployeada
guild-123.dkp.app → Container con su propia DB
guild-456.dkp.app → Container con su propia DB
```

**Ventajas**:
- Zero cambios al codigo actual
- Aislamiento total

**Desventajas**:
- Costos de hosting lineales
- Overhead de management (deployments x N)
- No escala bien para version gratuita

**Recomendacion**: Opcion A (database-per-tenant) aprovecha Turso y da aislamiento sin overhead de containers.

---

## Tareas de Implementacion

### 1. Platform Database
- **Tabla `guilds`**:
```sql
CREATE TABLE guilds (
    id TEXT PRIMARY KEY,           -- UUID
    name TEXT NOT NULL,
    realm TEXT,
    region TEXT DEFAULT 'eu',
    database_name TEXT NOT NULL,    -- Turso DB name
    plan TEXT DEFAULT 'free',       -- free, premium
    created_at TEXT DEFAULT (datetime('now')),
    owner_id TEXT NOT NULL,
    discord_guild_id TEXT,
    settings JSON                   -- guild-specific config
);
```

- **Tabla `platform_users`** (cross-guild):
```sql
CREATE TABLE platform_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
```

- **Tabla `guild_memberships`**:
```sql
CREATE TABLE guild_memberships (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    role TEXT DEFAULT 'raider',     -- admin, officer, raider
    character_name TEXT,
    joined_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, guild_id)
);
```

### 2. Tenant Resolution Middleware
```javascript
// middleware/tenant.js
export async function resolveTenant(req, res, next) {
    // Option 1: From subdomain (guild-name.dkp.app)
    const guildSlug = req.hostname.split('.')[0];

    // Option 2: From header (X-Guild-ID)
    // const guildId = req.headers['x-guild-id'];

    // Option 3: From JWT token (guild_id claim)
    // const guildId = req.user?.guild_id;

    const guild = await platformDb.get('SELECT * FROM guilds WHERE slug = ?', guildSlug);
    if (!guild) return res.status(404).json({ error: 'Guild not found' });

    req.guild = guild;
    req.db = getTenantDb(guild.database_name); // Turso connection to guild DB
    next();
}
```

### 3. Database Connection Pool
```javascript
// lib/tenantDb.js
const connectionPool = new Map();

export function getTenantDb(databaseName) {
    if (connectionPool.has(databaseName)) {
        return connectionPool.get(databaseName);
    }

    const client = createClient({
        url: `libsql://${databaseName}-${TURSO_ORG}.turso.io`,
        authToken: TURSO_AUTH_TOKEN,
    });

    connectionPool.set(databaseName, client);
    return client;
}
```
- **LRU eviction**: Cerrar conexiones idle despues de 30min
- **Max connections**: Limitar pool size

### 4. Guild Provisioning Flow
Cuando un nuevo guild se registra:
1. Crear registro en `guilds` table (platform DB)
2. Crear nueva Turso database via API
3. Aplicar migraciones (schema completo) a la nueva DB
4. Crear admin user en guild DB
5. Redirect a onboarding wizard

### 5. Refactoring: db → req.db
- **Impacto**: TODOS los archivos en `routes/` y `services/`
- **Actual**: `import { db } from '../database.js'`
- **Nuevo**: `const db = req.db` (inyectado por tenant middleware)
- **Esto es el cambio mas grande**: Requiere pasar `db` como parametro a todos los servicios
- **Alternativa**: AsyncLocalStorage para pasar el tenant DB sin cambiar firmas

### 6. Guild Settings
Mover configuraciones de guild de variables de entorno a la tabla `guilds.settings`:
- DKP cap
- Raid week start day
- Auction defaults (duration, min bid)
- WCL guild name
- Blizzard realm/region
- Notification preferences

---

## Consideraciones

### Subdominio vs Path
- **Subdominio**: `my-guild.dkp.app` — mas limpio, necesita wildcard DNS + SSL
- **Path**: `dkp.app/g/my-guild` — mas simple, un solo dominio
- **Recomendacion**: Path para MVP, subdominio despues

### Free Tier Limits
- 1 guild per account
- 30 members max
- 30 days data retention
- No Discord bot
- No analytics avanzados

### Premium Tier
- Unlimited guilds
- Unlimited members
- Unlimited retention
- Discord bot
- Full analytics
- Priority support
- Export data

### Data Migration
- Necesitas script para migrar la DB actual (single-tenant) a una guild tenant DB
- Usuarios existentes se convierten en platform_users + guild_membership

---

## Archivos a crear/modificar
- Crear: `lib/tenantDb.js` — connection pool
- Crear: `middleware/tenant.js` — tenant resolution
- Crear: `lib/provisioning.js` — guild creation
- Crear: `platformDb.js` — platform database
- Modificar: TODOS los `routes/*.js` — `db` → `req.db`
- Modificar: TODOS los `services/*.js` — aceptar `db` como parametro
- Modificar: `server.js` — mount tenant middleware
- Modificar: `database.js` — migration runner reutilizable

## Verificacion
- [ ] Dos guilds pueden coexistir con datos aislados
- [ ] Nuevo guild se provisiona automaticamente
- [ ] Tenant resolution funciona (por path o subdominio)
- [ ] Conexiones DB se reusan y se cierran cuando idle
- [ ] Migraciones aplican a todas las guild DBs
- [ ] Datos existentes migrados a formato tenant
- [ ] Tests pasan con tenant middleware
