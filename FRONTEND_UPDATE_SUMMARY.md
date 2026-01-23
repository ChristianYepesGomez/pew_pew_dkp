# Frontend Update Summary - DKP System

**Fecha**: 2026-01-23
**Última actualización**: Commit `302337f`

## 📋 Resumen de Cambios Disponibles

Todos los cambios han sido pusheados a la rama `master` y están listos para ser integrados por el equipo de frontend.

---

## ✨ Nuevas Funcionalidades

### 1. Sistema Multi-idioma (ES/EN)
- **Selector de idioma**: Dropdown con banderas 🇪🇸 Español / 🇬🇧 English
- **Persistencia**: El idioma se guarda en `localStorage`
- **Archivos afectados**:
  - `public/translations.js` - Todas las traducciones
  - `public/index.html` - Dashboard principal
  - `public/login.html` - Página de login

**Uso**:
```javascript
// Obtener traducción
const lang = localStorage.getItem('language') || 'es';
const texto = t('key', lang);

// Cambiar idioma
changeLanguage('en'); // o 'es'
```

### 2. Warcraft Logs Mejorado

#### Backend (`/api/warcraftlogs/preview`)
**Respuesta actualizada**:
```json
{
  "report": {
    "code": "rd28max7WNBGFhA6",
    "bossesKilled": 2,
    "totalBosses": 2,
    "totalAttempts": 33,
    "bosses": [
      {
        "encounterID": 1234,
        "name": "Boss Name",
        "killed": true,
        "attempts": 15
      }
    ]
  },
  "can_proceed": true  // Siempre true ahora
}
```

**Cambios importantes**:
- ✅ **Bosses únicos detectados correctamente** (no cuenta intentos como bosses separados)
- ✅ **Se pueden repetir logs** (eliminada validación de duplicados)
- ✅ **Se puede procesar sin jugadores encontrados** (`can_proceed` siempre true)

### 3. Tabla de Miembros Rediseñada

**Estructura de columnas**:
| Columna | Contenido |
|---------|-----------|
| Personaje | Icono de clase + Nombre (con color de clase) |
| Especialización | Spec del personaje |
| Rol | Icono de rol + Texto (Tank/Healer/DPS) |
| DKP | Cantidad actual de DKP |
| Acciones | Botones de admin (si aplica) |

**Iconos utilizados**:
```javascript
// Clase icons (Wowhead)
`https://wow.zamimg.com/images/wow/icons/small/classicon_${clase}.jpg`
// Ejemplo: classicon_warrior.jpg, classicon_mage.jpg, etc.

// Role icons (Wowhead)
Tank:   'https://wow.zamimg.com/images/wow/icons/small/inv_shield_06.jpg'
Healer: 'https://wow.zamimg.com/images/wow/icons/small/spell_holy_flashheal.jpg'
DPS:    'https://wow.zamimg.com/images/wow/icons/small/inv_sword_27.jpg'
```

### 4. Botones de Administración

#### Botón "Añadir Miembro"
- **Ubicación**: Pestaña "Miembros"
- **Visible para**: Admin y Officer
- **Endpoint**: `POST /api/auth/register`
- **Campos requeridos**:
  ```json
  {
    "username": "string",
    "password": "string",
    "characterName": "string",
    "characterClass": "string",
    "raidRole": "Tank|Healer|DPS",
    "spec": "string"
  }
  ```

#### Botón "Crear Subasta"
- **Ubicación**: Pestaña "Subasta Activa"
- **Visible para**: Admin y Officer
- **Endpoint**: `POST /api/auctions`
- **Campos requeridos**:
  ```json
  {
    "item_name": "string",
    "min_bid": number,
    "item_rarity": "epic",
    "item_image": "⚔️"
  }
  ```

---

## 🔧 APIs Disponibles

### Warcraft Logs
```
POST /api/warcraftlogs/preview
Body: { "url": "https://www.warcraftlogs.com/reports/..." }
```

```
POST /api/warcraftlogs/confirm
Body: { "reportId": "reportCode" }
```

### Miembros
```
GET /api/members
→ Retorna lista de todos los miembros

POST /api/auth/register
→ Crea nuevo miembro (requiere admin/officer)
```

### Subastas
```
GET /api/auctions/active
→ Retorna subasta activa

POST /api/auctions
→ Crea nueva subasta (requiere admin/officer)

GET /api/auctions/history
→ Retorna historial de subastas
```

### DKP
```
POST /api/dkp/adjust
Body: { "userId": number, "amount": number, "reason": "string" }
→ Ajustar DKP de un usuario

POST /api/dkp/bulk-adjust
Body: { "userIds": [numbers], "amount": number, "reason": "string" }
→ Ajuste masivo de DKP
```

---

## 📦 Archivos Clave para Frontend

### JavaScript/Traducciones
- `public/translations.js` - Sistema de traducciones ES/EN
- `public/index.html` - Dashboard principal con todas las funcionalidades
- `public/login.html` - Login con soporte multi-idioma
- `public/register.html` - Registro de usuarios
- `public/auctions.html` - Historial de subastas

### Estilos
Los estilos están inline en cada HTML usando:
- Bootstrap 5.3.0
- Font Awesome 6.4.0
- Paleta "Midnight Edition" personalizada

---

## 🎨 Colores de Clases WoW

```javascript
const classColors = {
  'Warrior': '#C79C6E',
  'Paladin': '#F58CBA',
  'Hunter': '#ABD473',
  'Rogue': '#FFF569',
  'Priest': '#FFFFFF',
  'Shaman': '#0070DE',
  'Mage': '#40C7EB',
  'Warlock': '#8788EE',
  'Druid': '#FF7D0A',
  'Death Knight': '#C41F3B'
};
```

---

## 🚀 Deployment

### Backend está corriendo en:
- **Puerto**: 3000
- **Docker**: Container `dkp-backend` activo
- **Health check**: `http://localhost:3000/health`

### Para actualizar el frontend:
1. Pull de la rama `master`
2. El backend ya está actualizado en Docker
3. Todas las APIs están disponibles en `http://localhost:3000/api`

---

## 📝 Notas Importantes

1. **Warcraft Logs** ahora permite:
   - Procesar logs múltiples veces
   - Procesar sin jugadores encontrados
   - Muestra bosses únicos correctamente

2. **Iconos** se cargan desde Wowhead (CDN externo)
   - Verificar conectividad en producción
   - Considerar fallback para iconos

3. **Multi-idioma**:
   - Default: Español (es)
   - Se puede extender fácilmente a más idiomas en `translations.js`

4. **Botones de admin**:
   - Se ocultan/muestran automáticamente según rol
   - Frontend ya tiene las funciones JavaScript implementadas

---

## 🐛 Testing Recomendado

- [ ] Cambio de idioma persiste entre sesiones
- [ ] Iconos de clase y rol se cargan correctamente
- [ ] Warcraft Logs procesa correctamente (test con URL de ejemplo)
- [ ] Botones de admin visibles solo para roles correctos
- [ ] Creación de miembros funciona
- [ ] Creación de subastas funciona

---

## 📞 Contacto

Si encuentran algún problema o necesitan más detalles, revisar:
- `WARCRAFTLOGS_INTEGRATION.md` - Documentación completa de WCL
- `WOW_CLASS_SPECS.md` - Referencia de especializaciones
- Logs de Docker: `docker-compose logs backend`

**Estado**: ✅ Todo listo para desarrollo frontend
