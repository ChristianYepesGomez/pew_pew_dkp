# 🎮 Integración con Warcraft Logs

Sistema automático de asignación de DKP basado en logs de Warcraft Logs.

---

## 📋 Descripción General

Este sistema permite asignar DKP automáticamente a los miembros del roster basándose en su participación en raids registradas en Warcraft Logs.

### Flujo de Trabajo

```
1. Admin pega URL del log de Warcraft Logs
    ↓
2. Sistema procesa el log y muestra preview
    ↓
3. Se muestran participantes detectados + anomalías
    ↓
4. Admin revisa y confirma
    ↓
5. Sistema asigna DKP automáticamente
```

---

## ⚙️ Configuración Inicial

### 1. Crear Cliente en Warcraft Logs

1. Inicia sesión en [Warcraft Logs](https://www.warcraftlogs.com/)
2. Ve a [Client Management](https://www.warcraftlogs.com/api/clients)
3. Click en **"Create Client"**
4. Completa:
   - **Client Name**: `DKP System` (o el nombre que prefieras)
   - **Redirect URIs**: Dejar vacío (no necesario para client credentials flow)
5. Click **"Create"**
6. **Copia** el `Client ID` y `Client Secret`

### 2. Configurar Backend

Edita el archivo [.env](c:\Proyectos\dkp-backend\.env):

```env
# Warcraft Logs API
WARCRAFTLOGS_CLIENT_ID=tu-client-id-aqui
WARCRAFTLOGS_CLIENT_SECRET=tu-client-secret-aqui
```

### 3. Reiniciar Backend

```bash
cd /c/Proyectos/dkp-backend
docker-compose restart
```

---

## 🗄️ Estructura de Base de Datos

### Nuevas Tablas

#### `warcraft_logs_processed`
Registra todos los logs procesados para evitar duplicados.

```sql
CREATE TABLE warcraft_logs_processed (
  id INTEGER PRIMARY KEY,
  report_code TEXT UNIQUE NOT NULL,
  report_title TEXT,
  start_time INTEGER,
  end_time INTEGER,
  region TEXT,
  guild_name TEXT,
  participants_count INTEGER,
  dkp_assigned INTEGER,
  processed_by INTEGER,
  processed_at DATETIME
);
```

#### `dkp_config`
Configuración de DKP personalizable.

```sql
CREATE TABLE dkp_config (
  id INTEGER PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT
);
```

**Configuración por defecto**:
- `raid_attendance_dkp`: `50` - DKP base por asistencia
- `boss_kill_bonus`: `10` - DKP adicional por cada boss derrotado
- `default_server`: `Ragnaros` - Servidor por defecto de la guild
- `auto_assign_enabled`: `false` - Requiere confirmación manual

### Columna Añadida a `users`

- `server` (TEXT): Nombre del servidor WoW (ej: "Ragnaros", "Firemaw")

---

## 🔌 API Endpoints

### GET `/api/warcraftlogs/config`

Obtiene la configuración actual de DKP.

**Requiere**: Token JWT (Officer o Admin)

**Respuesta**:
```json
{
  "configured": true,
  "config": {
    "raid_attendance_dkp": {
      "value": "50",
      "description": "DKP base por asistencia a raid"
    },
    "boss_kill_bonus": {
      "value": "10",
      "description": "DKP bonus adicional por cada boss derrotado"
    }
  }
}
```

---

### PUT `/api/warcraftlogs/config`

Actualiza la configuración de DKP.

**Requiere**: Token JWT (Admin)

**Body**:
```json
{
  "config_key": "raid_attendance_dkp",
  "config_value": "75"
}
```

**Respuesta**:
```json
{
  "message": "Configuration updated",
  "config_key": "raid_attendance_dkp",
  "config_value": "75"
}
```

---

### POST `/api/warcraftlogs/preview`

Procesa un log de Warcraft Logs y muestra preview antes de asignar DKP.

**Requiere**: Token JWT (Officer o Admin)

**Body**:
```json
{
  "url": "https://www.warcraftlogs.com/reports/J1p4M8gd3b72RLGC"
}
```

**Respuesta**:
```json
{
  "report": {
    "code": "J1p4M8gd3b72RLGC",
    "title": "Molten Core - 22/01/2026",
    "participantCount": 40,
    "bossesKilled": 8,
    "totalBosses": 10,
    "duration": 180
  },
  "dkp_calculation": {
    "base_dkp": 50,
    "boss_bonus": 10,
    "bosses_killed": 8,
    "dkp_per_player": 130,
    "total_dkp_to_assign": 5200
  },
  "participants": [
    {
      "wcl_name": "Arthas",
      "wcl_server": "Ragnaros",
      "wcl_class": "Warrior",
      "matched": true,
      "user_id": 5,
      "username": "Lolilop",
      "character_name": "Arthas",
      "current_dkp": 450,
      "server_match": true,
      "dkp_to_assign": 130
    },
    {
      "wcl_name": "Jaina",
      "wcl_server": "Firemaw",
      "wcl_class": "Mage",
      "matched": false,
      "user_id": null,
      "dkp_to_assign": 0
    }
  ],
  "summary": {
    "total_participants": 40,
    "matched": 38,
    "not_matched": 2,
    "anomalies_count": 2
  },
  "anomalies": [
    {
      "type": "not_found",
      "message": "Jaina (Firemaw) no encontrado en la base de datos",
      "participant": "Jaina"
    }
  ],
  "can_proceed": true
}
```

---

### POST `/api/warcraftlogs/confirm`

Confirma y asigna DKP a los participantes del log.

**Requiere**: Token JWT (Officer o Admin)

**Body**:
```json
{
  "reportCode": "J1p4M8gd3b72RLGC",
  "reportTitle": "Molten Core - 22/01/2026",
  "startTime": 1737564000000,
  "endTime": 1737574800000,
  "region": "EU",
  "guildName": "My Guild",
  "participants": [
    {
      "matched": true,
      "user_id": 5,
      "dkp_to_assign": 130
    }
  ]
}
```

**Respuesta**:
```json
{
  "message": "DKP assigned successfully from Warcraft Logs",
  "report_code": "J1p4M8gd3b72RLGC",
  "participants_count": 38,
  "total_dkp_assigned": 4940
}
```

---

### GET `/api/warcraftlogs/history`

Obtiene el historial de logs procesados.

**Requiere**: Token JWT

**Query Params**:
- `limit` (opcional): Número de registros (default: 50)

**Respuesta**:
```json
[
  {
    "id": 1,
    "report_code": "J1p4M8gd3b72RLGC",
    "report_title": "Molten Core - 22/01/2026",
    "start_time": 1737564000000,
    "end_time": 1737574800000,
    "participants_count": 38,
    "dkp_assigned": 4940,
    "processed_by": 1,
    "processed_by_name": "GuildMaster",
    "processed_at": "2026-01-22 16:30:00"
  }
]
```

---

## 🎯 Sistema de Matching

### Identificación de Jugadores

El sistema identifica jugadores por `character_name` (case-insensitive):
- **Base de datos**: `username` = "Lolilop", `character_name` = "Arthas"
- **Warcraft Logs**: `name` = "Arthas"
- **Match**: ✅ (por character_name)

### Verificación de Servidor (Opcional)

Si el usuario tiene configurado el campo `server`:
- Compara `users.server` con el servidor del log
- Si no coincide, genera **anomalía** pero NO impide el match
- Si el usuario NO tiene servidor configurado, no verifica

### Anomalías Detectadas

#### 1. `not_found`
Participante en el log que NO existe en la base de datos.

**Acción**: No se le asigna DKP. Admin debe crear el usuario primero.

#### 2. `server_mismatch`
Usuario encontrado pero servidor no coincide.

**Acción**: Se puede asignar DKP, pero se alerta para revisión.

---

## 📊 Cálculo de DKP

### Fórmula

```
DKP por jugador = base_dkp + (bosses_killed × boss_bonus)
```

**Ejemplo**:
- Base DKP: 50
- Boss bonus: 10
- Bosses derrotados: 8

```
50 + (8 × 10) = 130 DKP por jugador
```

### Configuración

Los valores son **configurables** desde el endpoint `/api/warcraftlogs/config`.

---

## ⚠️ Validaciones

### 1. Log Ya Procesado
Si intentas procesar el mismo log dos veces:
```json
{
  "error": "This report has already been processed",
  "processedAt": "2026-01-22 16:30:00",
  "dkpAssigned": 4940
}
```

### 2. No Matched Participants
Si ningún participante del log está en la BD:
```json
{
  "error": "No matched participants to assign DKP"
}
```

### 3. Credenciales No Configuradas
Si no has configurado `WARCRAFTLOGS_CLIENT_ID`:
```json
{
  "error": "Warcraft Logs API not configured. Please set credentials in .env"
}
```

---

## 🔍 Ejemplo Completo de Uso

### Paso 1: Configurar miembros en BD

Asegúrate de que tus miembros tienen `character_name` configurado:

```sql
UPDATE users SET character_name = 'Arthas', server = 'Ragnaros' WHERE id = 5;
UPDATE users SET character_name = 'Jaina', server = 'Ragnaros' WHERE id = 6;
```

### Paso 2: Preview del log

```bash
curl -X POST http://localhost:3000/api/warcraftlogs/preview \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.warcraftlogs.com/reports/ABC123XYZ"}'
```

### Paso 3: Revisar anomalías

Revisa la respuesta:
- ✅ `matched: true` - Usuario identificado, DKP se asignará
- ❌ `matched: false` - Usuario NO encontrado, no recibirá DKP
- ⚠️ `server_match: false` - Servidor diferente, revisar

### Paso 4: Confirmar asignación

```bash
curl -X POST http://localhost:3000/api/warcraftlogs/confirm \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reportCode": "ABC123XYZ",
    "reportTitle": "Molten Core",
    "participants": [...]
  }'
```

---

## 🚀 Próximas Mejoras Potenciales

- [ ] Asignación automática sin confirmación (configurar via `auto_assign_enabled`)
- [ ] Bonus por tiempo de raid (raids largas = más DKP)
- [ ] Penalización por muerte
- [ ] Webhooks para notificaciones en Discord
- [ ] Importación masiva de múltiples logs
- [ ] Interfaz web para gestionar configuración

---

## 📝 Notas Técnicas

### Autenticación con WCL
- Usa OAuth 2.0 Client Credentials Flow
- Token se cachea en memoria (válido 24h)
- Se renueva automáticamente al expirar

### Rate Limiting
Warcraft Logs API tiene límites:
- ~300 requests/minuto (sin confirmar)
- El sistema cachea tokens para reducir requests

### GraphQL Query
El sistema usa esta query para obtener participantes:

```graphql
query GetReportData($reportCode: String!) {
  reportData {
    report(code: $reportCode) {
      code
      title
      masterData(translate: true) {
        actors(type: "Player") {
          id
          name
          server
          subType
        }
      }
    }
  }
}
```

---

*Documentación generada: 2026-01-22*
*Sistema DKP - Warcraft Logs Integration v1.0*
