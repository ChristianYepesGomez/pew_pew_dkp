# Brief 03: Bug Fixes

## Prioridad: ALTA
## Esfuerzo estimado: 0.5-1 dia
## Fase: Hardening (pre-producto)

---

## Contexto
Bugs concretos encontrados durante el analisis. Algunos afectan la integridad de datos (death rate, consumable score), otros son edge cases en el sistema de subastas.

---

## Tareas

### 1. Death rate calculation — SQL incorrecto
- **Archivo**: `services/performanceAnalysis.js` linea ~191
- **Problema**:
```sql
ROUND(CAST(SUM(p.deaths) AS REAL) / MAX(COUNT(*), 1), 2) as deathRate
```
`MAX(COUNT(*), 1)` es sintaxis incorrecta en SQLite (nested aggregate). Devuelve death rates erroneos.
- **Fix**: Cambiar a:
```sql
ROUND(CAST(SUM(p.deaths) AS REAL) / COUNT(*), 2) as deathRate
```
- **Nota**: Si COUNT(*) puede ser 0, usar `NULLIF(COUNT(*), 0)` para evitar division por cero.

### 2. Consumable score — pesos inconsistentes
- **Archivo**: `services/performanceAnalysis.js` lineas ~221-224
- **Problema**: Los pesos (health potion 20%, healthstone 15%, combat potion 25%, flask 25%, food 10%, augment 5%) suman 100 pero la formula no los aplica correctamente. Flask uptime ponderado igual que combat potion usage rate — son metricas diferentes.
- **Accion**: Revisar la formula completa, asegurar que los pesos se apliquen sobre metricas normalizadas 0-1 antes de ponderar.

### 3. Anti-snipe sin cap maximo de duracion
- **Archivo**: `routes/auctions.js` lineas ~225-232 (o `lib/auctionScheduler.js`)
- **Problema**: Cada bid en los ultimos 30 segundos extiende 30 segundos. No hay limite maximo.
- **Escenario**: Dos usuarios haciendo bids alternados cada 29 segundos = auction infinita
- **Fix**: Agregar max extension total (sugerido: 5 minutos maximo de extension acumulada)
```javascript
const MAX_EXTENSION_MS = 5 * 60 * 1000;
const totalExtended = newEndTime - originalEndTime;
if (totalExtended > MAX_EXTENSION_MS) {
    // No extender mas
}
```
- **Nota**: Necesitas almacenar `original_end_time` en la tabla auctions (o calcularlo a partir de `created_at + duration`)

### 4. Race condition en bid placement
- **Archivo**: `routes/auctions.js` lineas ~182-188
- **Problema**: Se valida que el bid sea mayor al maximo actual, pero otro bid podria llegar entre la validacion y el INSERT
- **Fix**: Opcion A: usar constraint `CHECK` en la DB. Opcion B: re-validar dentro de la transaccion con `SELECT ... FOR UPDATE` equivalent (en SQLite, la transaccion con EXCLUSIVE lock ya cubre esto — verificar que se use transaction)

### 5. Median calculation imprecisa
- **Archivo**: `services/performanceAnalysis.js` lineas ~124-127
- **Problema**: `Math.floor(length / 2)` para arrays de longitud par no promedia los dos valores centrales
- **Fix**:
```javascript
function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}
```

### 6. Blizzard API token refresh race condition
- **Archivo**: `services/blizzardAPI.js` lineas ~85-116
- **Problema**: Multiples calls concurrentes pueden triggear token refreshes simultaneos
- **Fix**: Patron de mutex/promise compartida:
```javascript
let tokenPromise = null;
async function getToken() {
    if (tokenPromise) return tokenPromise;
    if (isTokenValid()) return cachedToken;
    tokenPromise = refreshToken().finally(() => { tokenPromise = null; });
    return tokenPromise;
}
```

### 7. Difficulty normalization inconsistente
- **Archivo**: `services/raids.js` lineas ~752-760
- **Problema**: Maneja numeric y string formats pero WCL puede enviar valores inesperados
- **Accion**: Verificar que el mapping cubre todos los casos reales de WCL (1=LFR, 3=Normal, 4=Heroic, 5=Mythic) y loguear warnings para valores desconocidos

### 8. First kill detection race condition
- **Archivo**: `services/raids.js` lineas ~456-470
- **Problema**: Checks `existingStats.total_kills === 0` pero otro import concurrente podria incrementar entre check y update
- **Fix**: Usar atomico en SQL:
```sql
UPDATE boss_statistics
SET first_kill_date = ?, wipes_to_first_kill = ?
WHERE boss_id = ? AND difficulty = ? AND total_kills = 0
```
El `AND total_kills = 0` en el WHERE hace que solo aplique si sigue siendo 0.

---

## Archivos a revisar
- `services/performanceAnalysis.js`
- `routes/auctions.js`
- `lib/auctionScheduler.js`
- `services/blizzardAPI.js`
- `services/raids.js`

## Verificacion
- [ ] Death rates calculados correctamente (comparar con datos reales de WCL)
- [ ] Consumable scores son 0-100 coherentes
- [ ] Auction con anti-snipe no puede durar mas de X minutos extra
- [ ] Bids concurrentes no crean inconsistencias
- [ ] Median de [1,2,3,4] = 2.5 (no 3)
- [ ] Tests nuevos para cada bug fix
