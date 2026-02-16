# Brief 01: Security Hardening

## Prioridad: CRITICA
## Esfuerzo estimado: 1-2 dias
## Fase: Hardening (pre-producto)

---

## Contexto
El backend tiene buena base de seguridad (JWT, bcrypt, refresh token rotation, rate limiters), pero hay vulnerabilidades concretas que deben cerrarse antes de considerar esto un producto.

---

## Tareas

### 1. Encriptar refresh tokens en DB
- **Archivo**: `routes/auth.js` ~linea 42
- **Problema**: `INSERT INTO refresh_tokens (user_id, token, ...)` almacena JWT en texto plano
- **Ya existe**: `lib/encryption.js` con `encryptToken()` / `decryptToken()` — no se usa
- **Accion**: Encriptar token antes de INSERT, desencriptar al validar
- **Riesgo**: Si la DB se compromete, todos los refresh tokens quedan expuestos

### 2. Fail-fast en produccion sin secrets
- **Archivo**: `lib/config.js` lineas 11-15
- **Problema**: JWT_SECRET tiene valor por defecto placeholder. La app arranca en produccion con secrets inseguros
- **Accion**: Si `NODE_ENV === 'production'` y secrets son defaults, hacer `throw new Error()`
- **Patron referencia**: StillNoob usa env validation que lanza al cargar el modulo

### 3. Limitar tamano de JSON body
- **Archivo**: `server.js`
- **Problema**: No hay `express.json({ limit: '...' })`, vulnerable a DoS con payloads gigantes
- **Accion**: Agregar `app.use(express.json({ limit: '5mb' }))` (o '1mb' para la mayoria, '5mb' para avatar uploads)
- **Nota**: El avatar upload en `auth.js` linea 387 valida `> 700000` bytes, pero el body ya se parseo completo

### 4. Verificar expiracion de token de password reset
- **Archivo**: `routes/auth.js` — endpoint POST /reset-password
- **Problema**: El email dice "expira en 1 hora" pero hay que verificar que el backend realmente valide la expiracion
- **Accion**: Confirmar que el query de validacion incluya `WHERE expires_at > datetime('now')` o equivalente

### 5. Rate limit en password reset emails
- **Archivo**: `routes/auth.js` — endpoint POST /forgot-password
- **Problema**: Sin rate limit especifico, alguien puede spamear emails de reset
- **Accion**: Agregar rate limiter especifico (ej: 3 requests/hora por email/IP)

### 6. Validar request body size especifico por ruta
- **Archivos**: `routes/auth.js` (avatar), `routes/warcraftlogs.js` (imports)
- **Accion**: Considerar limits diferentes: 1mb global, 5mb para upload routes

---

## Archivos a revisar
- `lib/config.js`
- `lib/encryption.js`
- `routes/auth.js`
- `server.js`
- `lib/rateLimiters.js`
- `middleware/auth.js`

## Verificacion
- [ ] Refresh tokens encriptados en DB (verificar que login/refresh siguen funcionando)
- [ ] App NO arranca en prod con secrets default
- [ ] Request con body >5mb rechazado con 413
- [ ] Password reset con token expirado rechazado con 400
- [ ] Spam de forgot-password bloqueado por rate limiter
- [ ] Tests existentes siguen pasando
