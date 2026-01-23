# 🌙 Frontend DKP System - Midnight Edition

## 📋 Descripción del Proyecto

Sistema de gestión de **Dragon Kill Points (DKP)** para guilds de World of Warcraft. Frontend completo con tema **Midnight** (colores oscuros inspirados en la próxima expansión).

Este es el **frontend** que conecta con el backend del repositorio: https://github.com/ChristianYepesGomez/DKP

---

## 📁 Estructura del Proyecto

```
frontend-dkp/
│
├── index.html                      # Página principal (dashboard con pestañas)
├── login.html                      # Página de login (requiere backend)
├── register.html                   # Página de registro (requiere backend)
├── members.html                    # Lista de miembros del guild
├── auctions.html                   # Historial de subastas
│
├── README.md                       # Este archivo
└── INTEGRACION-BACKEND.md         # Guía de integración con backend
```

---

## 🎨 Características del Frontend

### Tema Visual
- **Colores Midnight**: Azules profundos, morados vibrantes, plateados
- **Efecto nebulosa**: Fondo con gradiente animado tipo espacio
- **Estrellas animadas**: Parpadeo sutil de estrellas
- **Cristal esmerilado**: Tarjetas semitransparentes con blur
- **Colores oficiales de clases WoW**: Todos los 12 con brillos

### Funcionalidades

#### Dashboard (index.html)
**Sistema de pestañas:**
1. **Mi Personaje** - Información, DKP actual, estadísticas, ranking
2. **Subasta Activa** - Objeto en subasta, pujas, botón para pujar
3. **Historial** - Todas las transacciones de DKP

#### Miembros (members.html)
- Lista completa de miembros
- Filtros por clase y rol
- Búsqueda por nombre
- Tabla ordenable (click en encabezados)
- Estadísticas del guild

#### Subastas (auctions.html)
- Historial de subastas pasadas
- Filtros por estado (finalizadas/canceladas)
- Filtros por rareza (legendarias/épicas)
- Búsqueda por nombre de objeto

---

## 🚀 Cómo Usar (Versión Demo)

### Sin Backend
Los archivos actuales funcionan con **datos de prueba** (hardcodeados en JavaScript):

```bash
# Opción 1: Abrir directamente
# Doble click en index.html

# Opción 2: Servidor local (recomendado)
python -m http.server 8080
# Abrir: http://localhost:8080/index.html
```

### Con Backend
Ver archivo `INTEGRACION-BACKEND.md` para instrucciones completas.

---

## 🔧 Tecnologías Utilizadas

- **HTML5** - Estructura
- **CSS3** - Estilos (+ Bootstrap 5.3)
- **JavaScript** (ES6+) - Funcionalidad
- **Bootstrap 5.3** - Framework CSS
- **Font Awesome 6.4** - Iconos
- **Google Fonts** - Fuente Cinzel (títulos)

---

## 🎯 Endpoints del Backend Que Se Usan

El frontend está preparado para conectarse a estos endpoints:

### Autenticación
```javascript
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

### DKP
```javascript
GET  /api/dkp/history/:userId
POST /api/dkp/adjust           // Solo officer+
POST /api/dkp/bulk-adjust      // Solo officer+
```

### Miembros
```javascript
GET  /api/members
```

### Subastas
```javascript
GET  /api/auctions/active
GET  /api/auctions/history
POST /api/auctions/:id/bid
```

### Socket.IO (Tiempo Real)
```javascript
// Eventos que escucha el frontend
socket.on('dkp_updated', ...)
socket.on('auction_started', ...)
socket.on('bid_placed', ...)
socket.on('auction_ended', ...)
```

---

## 📝 Datos de Prueba Incluidos

### Personaje Principal
- **Nombre**: Thrall
- **Clase**: Shaman
- **Rol**: Healer
- **DKP**: 450

### Miembros del Guild (15)
Thrall, Jaina, Arthas, Sylvanas, Anduin, Varian, Illidan, Malfurion, Tyrande, Garrosh, Gul'dan, Uther, Kael'thas, Vol'jin, Chen

### Subastas (10)
- Thunderfury (Legendaria) - 750 DKP
- Atiesh (Legendaria) - 680 DKP
- Sulfuras (Legendaria) - 620 DKP
- Tier 2 Helmet (Épica) - 280 DKP
- Y más...

---

## 🎨 Paleta de Colores Midnight

```css
/* Colores base */
--midnight-deepblue: #0a0e27;      /* Fondo oscuro */
--midnight-purple: #4a1a8f;        /* Morado principal */
--midnight-bright-purple: #8b5cf6; /* Púrpura brillante */
--midnight-glow: #a78bfa;          /* Brillo */
--midnight-silver: #e0e7ff;        /* Texto principal */
```

### Colores de Clases WoW
```css
Warrior:       #C79C6E (café/tan)
Paladin:       #F58CBA (rosa)
Hunter:        #ABD473 (verde lima)
Rogue:         #FFF569 (amarillo)
Priest:        #FFFFFF (blanco)
Shaman:        #0070DE (azul)
Mage:          #69CCF0 (cyan)
Warlock:       #9482C9 (púrpura)
Druid:         #FF7D0A (naranja)
Death Knight:  #C41F3B (rojo)
Demon Hunter:  #A330C9 (púrpura oscuro)
Monk:          #00FF96 (verde brillante)
```

---

## 🔗 Integración con Backend

### Cambios Necesarios

1. **Cambiar API_URL en cada archivo:**
```javascript
// En cada archivo .html, buscar:
const API_URL = 'http://localhost:3000/api';

// Cambiar por la URL de tu servidor:
const API_URL = 'https://tu-servidor.com/api';
```

2. **Activar funciones reales:**
   - Actualmente las funciones usan datos fake
   - Ver `INTEGRACION-BACKEND.md` para código de reemplazo

3. **Configurar Socket.IO:**
```javascript
// Cambiar:
const SOCKET_URL = 'http://localhost:3000';

// Por:
const SOCKET_URL = 'https://tu-servidor.com';
```

---

## 📚 Archivos Incluidos

### Páginas Principales
- `index.html` - Dashboard con pestañas ⭐ **PRINCIPAL**
- `login.html` - Página de login
- `register.html` - Página de registro

### Páginas Secundarias
- `members.html` - Lista de miembros
- `auctions.html` - Historial de subastas

### Documentación
- `README.md` - Este archivo
- `INTEGRACION-BACKEND.md` - Guía técnica de integración
- `CHEATSHEET.md` - Referencia rápida de código

---

## 🐛 Solución de Problemas

### Error de CORS
```
Access to fetch at '...' has been blocked by CORS policy
```

**Solución**: El backend debe permitir peticiones del frontend.

En el backend (server.js), agregar:
```javascript
const cors = require('cors');
app.use(cors({
    origin: 'http://localhost:8080', // URL del frontend
    credentials: true
}));
```

### Socket.IO no conecta
**Verificar**:
1. Backend está corriendo
2. URL de Socket.IO es correcta
3. Puerto correcto (3000 por defecto)

### Los colores no se ven bien
**Solución**: Algunos navegadores antiguos no soportan:
- `backdrop-filter: blur()`
- `text-shadow` con múltiples sombras

Usar Chrome, Firefox o Edge actualizados.

---

## 📖 Documentación Adicional

### Para el Desarrollador Frontend
- Todos los archivos HTML tienen comentarios detallados
- Cada función JavaScript está explicada
- Código organizado por secciones

### Para el Desarrollador Backend
- Ver `INTEGRACION-BACKEND.md`
- Lista de endpoints necesarios
- Formato de respuestas esperadas
- Eventos de Socket.IO

---

## 🎯 Próximos Pasos

1. **Configurar backend** según el README del repositorio
2. **Actualizar URLs** en los archivos HTML
3. **Probar login/registro** con usuarios reales
4. **Verificar Socket.IO** (subastas en tiempo real)
5. **Ajustar diseño** según necesidades

---

## 👥 Créditos

- **Frontend**: Li (DAW Student)
- **Backend**: [Nombre del compañero]
- **Tema**: Inspirado en World of Warcraft: Midnight
- **Colores de clases**: Oficiales de Blizzard Entertainment

---

## 📄 Licencia

Proyecto educativo - Desarrollo de Aplicaciones Web (DAW)

---

## 📞 Contacto

Para dudas sobre el frontend:
- Revisar comentarios en el código
- Ver CHEATSHEET.md para ejemplos
- Consultar INTEGRACION-BACKEND.md

---

**¡Que disfrutes trabajando con este proyecto! 🌙✨**

*For the Horde! For the Alliance!*
