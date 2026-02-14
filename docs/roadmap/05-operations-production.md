# Brief 05: Operations & Production Readiness

## Prioridad: ALTA
## Esfuerzo estimado: 1-2 dias
## Fase: Hardening (pre-producto)

---

## Contexto
El backend funciona correctamente pero carece de las practicas operacionales necesarias para un servicio de produccion confiable: graceful shutdown, health checks robustos, request tracing, y logging consistente. Estas son las cosas que hacen la diferencia entre "funciona en mi maquina" y "servicio confiable".

---

## Tareas

### 1. Graceful Shutdown
- **Archivo**: `server.js`
- **Problema**: `server.listen()` sin handler de SIGTERM/SIGINT. En deploy, requests in-flight mueren
- **Implementacion**:
```javascript
const gracefulShutdown = async (signal) => {
    log.info(`${signal} received, shutting down gracefully`);

    // Stop accepting new connections
    server.close(() => {
        log.info('HTTP server closed');
    });

    // Close Socket.IO connections
    io.close();

    // Close database connection
    // await db.close(); // si Turso client lo soporta

    // Force exit after timeout
    setTimeout(() => {
        log.error('Forced shutdown after timeout');
        process.exit(1);
    }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

### 2. Health Check Endpoint Robusto
- **Archivo**: Crear o mejorar ruta en `routes/` o directamente en `server.js`
- **Actual**: Posiblemente basico o inexistente
- **Implementacion**:
```javascript
app.get('/health', async (req, res) => {
    const checks = {};

    // Database check
    try {
        await db.get('SELECT 1');
        checks.database = 'ok';
    } catch (e) {
        checks.database = 'error';
    }

    const healthy = Object.values(checks).every(v => v === 'ok');
    res.status(healthy ? 200 : 503).json({
        status: healthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks
    });
});
```
- **Nota**: Este endpoint NO debe requerir autenticacion

### 3. Correlation IDs (Request Tracing)
- **Archivo**: Nuevo middleware en `middleware/` o en `server.js`
- **Problema**: Imposible correlacionar logs de un mismo request
- **Implementacion**:
```javascript
import { randomUUID } from 'crypto';

app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
});
```
- **Luego**: Pasar `req.id` al logger en cada ruta/servicio
- **Patron referencia**: StillNoob ya implementa esto

### 4. Request Logging Middleware
- **Archivo**: `server.js` o nuevo `middleware/requestLogger.js`
- **Implementacion**: Loguear cada request con duracion, status, y correlation ID:
```javascript
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        log.info('Request completed', {
            requestId: req.id,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            duration: Date.now() - start,
            userId: req.user?.id
        });
    });
    next();
});
```

### 5. Eliminar console.log Residuales
- **Archivos afectados**:
  - `routes/warcraftlogs.js` — console.log/error/warn
  - `routes/items.js` — console.log
  - `server.js` linea 122: `console.log('Client connected...')` → `log.info()`
  - `server.js` linea 129: similar
- **Accion**: Buscar TODOS los `console.log`, `console.error`, `console.warn` en el proyecto y reemplazar por el structured logger `createLogger('Module')` que ya existe en `lib/logger.js`

### 6. Database Migration Versioning
- **Archivo**: `database.js`
- **Problema**: Migraciones por try/catch que silencian errores. Si una migracion falla parcialmente, las futuras fallan silenciosamente
- **Solucion**: Crear tabla `db_migrations`:
```sql
CREATE TABLE IF NOT EXISTS db_migrations (
    id INTEGER PRIMARY KEY,
    version TEXT NOT NULL,
    applied_at TEXT DEFAULT (datetime('now')),
    description TEXT
);
```
- Cada migracion tiene version numerica. Al startup, check version actual vs migrations pendientes
- **Nota**: Esto es un refactor grande. Puede hacerse gradual: primero agregar la tabla, luego ir migrando las existentes

### 7. Unhandled Rejection/Exception Improvements
- **Archivo**: `server.js` lineas ~167-176
- **Actual**: Ya tiene handlers globales
- **Mejorar**: Asegurar que logueen con structured logger y incluyan stack trace completo
- **Agregar**: `process.on('uncaughtException', ...)` si no existe

### 8. Sentry Error Context
- **Archivo**: `server.js` lineas ~6-11
- **Accion**: Verificar que Sentry capture:
  - User context (userId, role)
  - Request context (method, path, correlation ID)
  - Extra context (relevant business data)

---

## Archivos a revisar
- `server.js`
- `lib/logger.js`
- `database.js`
- `middleware/auth.js`
- Todos los archivos en `routes/` y `services/` para console.log

## Verificacion
- [ ] SIGTERM cierra el servidor sin matar requests in-flight
- [ ] GET /health devuelve status + DB check sin auth
- [ ] Cada request tiene `x-request-id` header en response
- [ ] Logs incluyen requestId, method, path, duration, userId
- [ ] Zero `console.log/error/warn` en el codebase (solo structured logger)
- [ ] DB migrations versionadas (al menos la tabla existe)
- [ ] Sentry captura user y request context
