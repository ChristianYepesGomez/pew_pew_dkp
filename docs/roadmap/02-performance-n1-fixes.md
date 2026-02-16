# Brief 02: Performance & N+1 Query Fixes

## Prioridad: ALTA
## Esfuerzo estimado: 1-2 dias
## Fase: Hardening (pre-producto)

---

## Contexto
Hay multiples patrones N+1 en el codebase que multiplican queries innecesariamente. Con pocos usuarios no se nota, pero bajo carga (100+ auctions, 50+ members) el impacto es significativo. Tambien hay 42 `SELECT *` que desperdician I/O.

---

## Tareas

### 1. N+1 en auctions activas (MAS IMPACTANTE)
- **Archivo**: `routes/auctions.js` lineas 26-89
- **Problema**: `Promise.all(auctions.map(async (auction) => { const bids = await db.all(...) }))` — para 10 auctions = 10 queries
- **Solucion**: Una sola query con JOIN que traiga todas las bids de todas las auctions activas, luego agrupar en JS:
```sql
SELECT a.*, ab.user_id, ab.amount, u.character_name
FROM auctions a
LEFT JOIN auction_bids ab ON ab.auction_id = a.id
LEFT JOIN users u ON u.id = ab.user_id
WHERE a.status = 'active'
ORDER BY a.id, ab.amount DESC
```

### 2. N+1 en cierre de subastas
- **Archivo**: `lib/auctionScheduler.js` lineas ~280-286 (o `routes/auctions.js` cierre)
- **Problema**: Loop que valida DKP de cada bidder individualmente:
```javascript
for (const bid of allBids) {
    const bidderDkp = await tx.get('SELECT current_dkp FROM member_dkp WHERE user_id = ?', bid.user_id)
}
```
- **Solucion**: Cargar todos los DKP en una query:
```sql
SELECT user_id, current_dkp FROM member_dkp WHERE user_id IN (?, ?, ?)
```
Luego usar un Map para lookup O(1).

### 3. N+1 en WarcraftLogs actor mapping
- **Archivo**: `services/warcraftlogs.js` lineas 643-667
- **Problema**: `getFightStatsWithDeathEvents()` hace query GraphQL separada solo para mapear targetIDs a nombres
- **Solucion**: Incluir actor names en la query principal de death events, o pre-fetch actors una vez por report y reusar

### 4. Reemplazar SELECT * por columnas especificas
- **Archivos**: 42 ocurrencias across routes
- **Principales**:
  - `routes/auth.js` linea 248: `SELECT * FROM users` → `SELECT id, password FROM users WHERE id = ?`
  - `routes/bosses.js` linea 25: `SELECT * FROM boss_statistics` → solo columnas necesarias
  - `routes/members.js` linea 85: ya tiene columnas especificas (bien), verificar otros
- **Accion**: Buscar todos los `SELECT *` y reemplazar. Priorizar los que tocan tablas con muchas columnas (users, player_fight_performance)

### 5. Optimizar committed bids calculation
- **Archivo**: `routes/auctions.js` lineas 93-102 y 164-173
- **Problema**: Calculo de DKP comprometido en bids activas se repite en dos lugares con subquery compleja
- **Solucion**: Extraer a helper function y/o crear vista SQL

### 6. Config cache TTL
- **Archivo**: `lib/helpers.js` linea ~10
- **Problema**: TTL de 60 segundos para config. Con 100 RPS = muchos cache misses
- **Solucion**: Subir a 5 minutos, o implementar invalidacion por evento (cuando admin cambia config, resetear cache)

### 7. Indexes faltantes
- **Archivo**: `database.js` — seccion de indexes
- **Agregar**:
  - `idx_auctions_status_created` en `(status, created_at)` — filtro comun en /active
  - `idx_dkp_transactions_auction` en `dkp_transactions(auction_id)` — usado en history
  - `idx_auction_bids_auction` en `auction_bids(auction_id)` — join frecuente
  - Verificar si `idx_warcraftlogs_guild_date` existe para `warcraft_logs_processed`

---

## Archivos a revisar
- `routes/auctions.js`
- `lib/auctionScheduler.js`
- `services/warcraftlogs.js`
- `lib/helpers.js`
- `database.js`
- Todos los archivos en `routes/` para SELECT *

## Verificacion
- [ ] GET /auctions/active hace 1-2 queries en vez de N+1
- [ ] Cierre de auction batch-loads DKP data
- [ ] `SELECT *` eliminado de rutas principales
- [ ] Config cache con TTL >= 5min
- [ ] Nuevos indexes creados
- [ ] Tests existentes siguen pasando
- [ ] Medir: response time antes/despues en /auctions/active con datos de prueba
