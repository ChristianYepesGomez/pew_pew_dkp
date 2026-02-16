# Brief 04: Test Coverage Expansion

## Prioridad: ALTA
## Esfuerzo estimado: 3-5 dias
## Fase: Hardening (pre-producto)

---

## Contexto
Actualmente 176 tests cubriendo 46/106 endpoints (43%). Hay modulos enteros sin tests, incluyendo WarcraftLogs (tu feature core), Armory, Buffs, Items, y OAuth. No hay tests de Socket.IO, race conditions, ni rate limiting.

### Estado actual de tests

| Archivo | Tests | Cubre |
|---------|-------|-------|
| auth.test.js | 13 | register, login, me, profile |
| auth-extended.test.js | 16 | password changes, refresh tokens, logout |
| members.test.js | 11 | GET /members, role change, delete |
| auctions.test.js | 19 | create/list/bid/end/cancel, history |
| dkp.test.js | 16 | single/bulk adjust, history, decay |
| bis.test.js | 15 | BIS CRUD, ownership validation |
| characters.test.js | 35 | character CRUD, primary management |
| calendar.test.js | 30 | raid days, signups, DKP bonuses |
| routes-misc.test.js | 20 | health, bosses, analytics |
| public.test.js | 6 | health check, protected endpoints |

---

## Tareas por prioridad

### P1 — Modulos con CERO tests (criticos)

#### WarcraftLogs (requiere mocking de API externa)
- **Archivo nuevo**: `tests/warcraftlogs.test.js`
- **Endpoints**: 11+ endpoints en `routes/warcraftlogs.js`
- **Necesita**: Mock de GraphQL API de WCL (respuestas pre-grabadas)
- **Tests minimos**:
  - GET /config (auth required, admin only)
  - PUT /config (update WCL config)
  - POST /preview (preview import con report code valido/invalido)
  - POST /confirm (confirm import)
  - GET /history (import history)
  - POST /revert/:code (revert import, admin only)
  - GET /guild-reports
  - Error handling: WCL API down, invalid report code, rate limited

#### Armory
- **Archivo nuevo**: `tests/armory.test.js`
- **Endpoints**: `routes/armory.js`
- **Necesita**: Mock de Blizzard API
- **Tests minimos**:
  - GET /:userId/profile
  - GET /equipment/:realm/:character
  - GET /media/:realm/:character
  - Error: character not found, API timeout

#### Items / Raid Items
- **Archivo nuevo**: `tests/items.test.js`
- **Endpoints**: `routes/items.js`, `routes/raidItems.js`
- **Tests minimos**:
  - GET /raid-items (list all)
  - GET /raid-items/search?q=... (search)
  - GET /raid-items/:raidName (by raid)
  - GET /raids-list
  - GET /item-popularity

#### Buffs (SSE)
- **Archivo nuevo**: `tests/buffs.test.js`
- **Nota**: SSE testing requiere approach especial (EventSource mock o raw HTTP)
- **Tests minimos**:
  - GET /active (lista de buffs activos)
  - GET /stream (verificar headers SSE: Content-Type: text/event-stream)
  - Auth required

### P2 — Endpoints faltantes en modulos existentes

#### Auctions (faltan 3)
- GET /:auctionId/rolls — dice rolls en tie
- GET /:auctionId/bids — detalle de bids
- POST /cancel-all — cancel all (admin only)

#### Members (faltan 2)
- PUT /:id/vault — toggle vault status
- POST / — crear member

#### BIS (faltan 2)
- GET /user/:userId — ver BIS de otro usuario
- PUT /reorder — reordenar prioridades

#### DKP (falta 1)
- POST /decay — aplicar DKP decay

#### Auth (faltan 2)
- POST /forgot-password — solicitar reset
- POST /reset-password — completar reset

### P3 — Tests de integracion y edge cases

#### Socket.IO Real-time
- **Archivo nuevo**: `tests/realtime.test.js`
- **Tests**:
  - Conexion con token valido/invalido
  - Evento `dkp_updated` emitido al ajustar DKP
  - Evento `bid_placed` emitido al hacer bid
  - Evento `auction_ended` emitido al cerrar auction
  - Desconexion y reconexion

#### Race Conditions
- **Agregar a**: `tests/auctions.test.js`
- **Tests**:
  - Dos bids simultaneos en la misma auction
  - Bid que llega justo cuando auction cierra
  - DKP insuficiente por bid concurrente en otra auction

#### Rate Limiting
- **Archivo nuevo**: `tests/rate-limiting.test.js`
- **Tests**:
  - Auth rate limiter (20/15min): verificar 429 al exceder
  - API rate limiter (60/1min)
  - Import rate limiter (10/5min)

#### Transaction Integrity
- **Agregar a**: `tests/dkp.test.js`
- **Tests**:
  - Bulk adjust parcial (si uno falla, todos rollback)
  - DKP cap enforcement
  - DKP no puede quedar negativo

### P4 — CI/CD improvements

#### Coverage reporting
- **Archivo**: `.github/workflows/ci.yml`
- **Agregar**: `--coverage` flag a vitest
- **Threshold**: Enforcar minimo 60% (subir a 80% gradualmente)
- **Report**: Publicar coverage report como artifact o comentario en PR

---

## Infraestructura de testing necesaria

### Mock de APIs externas
Crear `tests/mocks/`:
- `warcraftlogs.mock.js` — respuestas GraphQL pre-grabadas
- `blizzard.mock.js` — respuestas de Blizzard API (character, equipment, items)
- Usar `vi.mock()` de Vitest para interceptar

### Helpers adicionales para `tests/helpers.js`
- `createTestAuction(adminToken, itemData)` — crear auction con item pre-seeded
- `createTestCharacter(userId, data)` — crear character para user
- `seedRaidItems()` — seed de items para tests de items/BIS
- `createSocketClient(token)` — helper para tests de Socket.IO

---

## Archivos a revisar
- `tests/helpers.js` — extender con nuevos helpers
- `tests/setup.js` — verificar que limpia TODAS las tablas (actualmente solo 8)
- `vitest.config.js`
- `.github/workflows/ci.yml`
- Todos los archivos en `routes/` para cross-reference

## Verificacion
- [ ] Coverage >= 60% (medir con `--coverage`)
- [ ] WarcraftLogs endpoints tienen tests con mocks
- [ ] Armory endpoints tienen tests con mocks
- [ ] Socket.IO eventos verificados
- [ ] Rate limiters verificados
- [ ] Race conditions en auctions testeadas
- [ ] CI pipeline reporta coverage
- [ ] Todos los 176 tests existentes siguen pasando
