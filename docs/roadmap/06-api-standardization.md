# Brief 06: API Standardization

## Prioridad: MEDIA
## Esfuerzo estimado: 2-3 dias
## Fase: Hardening / Product-Ready

---

## Contexto
El API funciona correctamente pero tiene inconsistencias en formato de respuestas, manejo de errores, y validacion. Para ser producto, el API debe ser predecible y bien documentada. Esto tambien facilita el desarrollo del Discord bot y futuros clientes.

---

## Tareas

### 1. Estandarizar Formato de Respuesta

**Actual (inconsistente):**
```javascript
// A veces:
res.json({ members: [...] })
// A veces:
res.json({ message: 'Updated', user: {...} })
// A veces:
res.json([...]) // array directo
// Errores a veces:
res.json({ error: 'Failed' })
// Errores a veces:
res.json({ error: 'Failed', required: 50, current: 30 })
```

**Propuesta (consistente):**
```javascript
// Success:
res.json({ success: true, data: { members: [...] } })
res.json({ success: true, data: { user: {...} }, message: 'Profile updated' })

// Error:
res.status(400).json({ success: false, error: 'Insufficient DKP', code: 'INSUFFICIENT_DKP', details: { required: 50, current: 30 } })
```

**Implementacion**: Crear helper functions:
```javascript
// lib/response.js
export const success = (res, data, message, status = 200) =>
    res.status(status).json({ success: true, data, message });

export const error = (res, message, status = 400, code, details) =>
    res.status(status).json({ success: false, error: message, code, details });
```

**NOTA**: Este cambio es BREAKING para el frontend. Hay que actualizar ambos en sync, o hacer la transicion gradual (aceptar ambos formatos en frontend primero).

### 2. Error Codes Catalog
- **Archivo nuevo**: `lib/errorCodes.js`
- **Proposito**: Codigos de error estandar que frontend puede usar para i18n:
```javascript
export const ErrorCodes = {
    INSUFFICIENT_DKP: 'INSUFFICIENT_DKP',
    AUCTION_CLOSED: 'AUCTION_CLOSED',
    ALREADY_EXISTS: 'ALREADY_EXISTS',
    NOT_FOUND: 'NOT_FOUND',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMITED: 'RATE_LIMITED',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
};
```

### 3. Input Validation Consistency
- **Problema**: Algunos endpoints validan parseInt + isNaN, otros no
- **Solucion**: Crear middleware de validacion reutilizable:
```javascript
// middleware/validate.js
export const validateParams = (schema) => (req, res, next) => {
    // Validar req.params contra schema
    // Ejemplo: { id: 'integer', userId: 'integer' }
};

export const validateBody = (schema) => (req, res, next) => {
    // Validar req.body contra schema
    // Ejemplo: { amount: { type: 'integer', min: 1 }, reason: { type: 'string', required: true } }
};
```
- **Alternativa**: Usar `zod` o `joi` (pero mantener el principio de no over-engineer)
- **Minimo**: Extraer la validacion de parseInt + isNaN a un helper reutilizable

### 4. Pagination Estandar
- **Problema actual**: Algunos endpoints paginan (`limit` param), otros no. Sin `offset`, sin validacion de limites
- **Implementacion**:
```javascript
// lib/pagination.js
export function parsePagination(query, defaults = { limit: 50, maxLimit: 100 }) {
    const limit = Math.min(Math.max(parseInt(query.limit) || defaults.limit, 1), defaults.maxLimit);
    const offset = Math.max(parseInt(query.offset) || 0, 0);
    return { limit, offset };
}

// Respuesta paginada:
{ success: true, data: [...], pagination: { limit, offset, total, hasMore } }
```
- **Endpoints que necesitan paginacion**:
  - GET /auctions/history (actualmente `limit` sin `offset`)
  - GET /members (actualmente sin paginacion)
  - GET /dkp/history/:userId
  - GET /warcraftlogs/history

### 5. Estandarizar Mensajes de Error
- **Problema**: Algunos errores son genericos ("Failed to get members"), otros especificos ("Invalid user ID")
- **Accion**: Audit de todos los mensajes de error y estandarizar:
  - Errores de validacion: descriptivos y accionables
  - Errores internos: mensaje generico al cliente, detalle en logs
  - Nunca exponer stack traces o detalles internos al cliente

### 6. API Versioning (futuro)
- **No implementar ahora**, pero preparar la estructura:
  - Actual: `/api/members`
  - Futuro: `/api/v1/members`
- **Accion minima**: Documentar en `docs/api.md` que la version actual es v1 implicitamente
- Cuando se necesite v2, mount routes bajo `/api/v2/`

### 7. Endpoint Security Audit — Read Permissions
- **Archivo**: `routes/dkp.js` linea ~157
- **Problema**: `GET /history/:userId` requiere auth pero no valida que un raider solo vea su propio historial
- **Regla**: Raiders solo ven su propio DKP history. Officers/admins ven cualquiera.
- **Accion**: Agregar check:
```javascript
if (req.user.role === 'raider' && req.user.id !== parseInt(userId)) {
    return res.status(403).json({ error: 'Forbidden' });
}
```
- **Revisar todos los GET endpoints** para el mismo patron

---

## Archivos a revisar/crear
- Crear: `lib/response.js`
- Crear: `lib/errorCodes.js`
- Crear: `lib/pagination.js`
- Crear o extender: `middleware/validate.js`
- Modificar: Todos los archivos en `routes/`
- Modificar: Frontend `src/services/api.js` (adaptar a nuevo formato)
- Actualizar: `docs/api.md`

## Verificacion
- [ ] Todas las respuestas siguen formato `{ success, data?, error?, message? }`
- [ ] Error codes documentados y usados consistentemente
- [ ] parseInt + isNaN validacion en TODOS los endpoints con :id params
- [ ] Paginacion funcional en endpoints de listas
- [ ] GET /dkp/history/:userId restringido por role
- [ ] Frontend actualizado para nuevo formato de respuesta
- [ ] Tests actualizados para nuevo formato
- [ ] docs/api.md actualizado
