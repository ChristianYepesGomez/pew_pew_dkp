# 📘 Guía para el Equipo de Frontend

Esta guía explica cómo el equipo de frontend puede trabajar en el proyecto DKP sin interferir con el frontend provisional.

---

## 🌿 Estrategia de Ramas

### Ramas Actuales

1. **`master`** - Backend estable (producción)
   - Contiene solo el backend
   - No tocar esta rama para frontend

2. **`frontend-provisional`** - Frontend provisional de React
   - Frontend funcional creado como solución temporal
   - Usar como referencia pero NO como base para desarrollo
   - Ubicación: `/frontend/` dentro de esta rama

3. **`frontend-nuevo`** (Para crear) - Nuevo frontend del equipo
   - El equipo de frontend trabajará aquí
   - Completa libertad de tecnologías y estructura

---

## 🚀 Cómo Empezar

### Opción 1: Nueva Rama desde Master (Recomendado)

```bash
# 1. Clona el repositorio
git clone https://github.com/ChristianYepesGomez/DKP.git
cd DKP

# 2. Crea una nueva rama para el frontend nuevo
git checkout -b frontend-nuevo

# 3. Crea la carpeta del nuevo frontend
mkdir frontend-new
cd frontend-new

# 4. Inicializa tu proyecto (ejemplo con Vite)
npm create vite@latest . -- --template react
# O usa Next.js, Remix, o lo que prefieras

# 5. Configura la conexión con el backend
# El backend estará en http://localhost:3000
```

### Opción 2: Repositorio Separado (Alternativa)

Si prefieren trabajar en un repositorio completamente separado:

```bash
# 1. Crea un nuevo repo: dkp-frontend-v2
# 2. Conéctalo solo con el backend vía API
# 3. Merge cuando esté listo
```

---

## 🔌 Conexión con el Backend

### Endpoints Disponibles

El backend está corriendo en `http://localhost:3000`

**Autenticación:**
```javascript
POST /api/auth/login
POST /api/auth/register
GET  /api/auth/me
```

**Miembros:**
```javascript
GET    /api/members
POST   /api/dkp/adjust
GET    /api/dkp/history/:userId
```

**Subastas:**
```javascript
GET    /api/auctions/active
POST   /api/auctions
POST   /api/auctions/:id/bid
POST   /api/auctions/:id/end
```

**Admin:**
```javascript
POST   /api/warcraftlogs/preview
POST   /api/warcraftlogs/confirm
GET    /api/warcraftlogs/config
PUT    /api/warcraftlogs/config
```

### Configuración de API Client

**Ejemplo con Axios:**

```javascript
// src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Variables de Entorno

Crea un archivo `.env` en tu frontend:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

---

## 📋 Frontend Provisional como Referencia

### Ver el Frontend Provisional

```bash
git checkout frontend-provisional
cd frontend
npm install
npm run dev
```

Esto te permitirá ver:
- ✅ Cómo se conecta al backend
- ✅ Qué endpoints se usan
- ✅ Estructura de datos esperada
- ✅ Funcionalidades implementadas

**IMPORTANTE**: No uses este código como base. Es provisional y será reemplazado.

### Funcionalidades Actuales del Provisional

- Login/Logout con JWT
- Roster con filtrado y ordenamiento
- Sistema de subastas con pujas
- Historial de transacciones DKP
- Panel admin con Warcraft Logs
- Multi-idioma (ES/EN)
- Dark theme

---

## 🎨 Diseño y UI/UX

### Herramientas Recomendadas

1. **Figma** - Para diseño colaborativo
   - https://figma.com
   - Gratis para equipos pequeños

2. **Pencil** - Para wireframes rápidos
   - https://pencil.evolus.vn

3. **TailwindCSS / Material-UI / Chakra UI**
   - Para componentes listos

### Paleta de Colores Actual (Provisional)

```css
/* Dark Theme */
--bg-primary: #0a0e1a;
--bg-secondary: #16192a;
--bg-tertiary: #1e2139;
--text-primary: #e4e6eb;
--text-secondary: #8b8d98;
--accent: #4a90e2;
--success: #43b581;
--error: #f04747;
```

Puedes cambiarla completamente para el nuevo frontend.

---

## 🔄 Workflow Recomendado

### 1. Desarrollo Local

```bash
# Terminal 1: Backend
docker-compose up

# Terminal 2: Frontend Nuevo
cd frontend-new
npm run dev
```

### 2. Testing

```bash
# Asegúrate de que el backend esté corriendo
curl http://localhost:3000/health

# Prueba la conexión desde el frontend
# Los endpoints deben responder correctamente
```

### 3. Commits

```bash
git add .
git commit -m "feat: add new dashboard component"
git push origin frontend-nuevo
```

### 4. Pull Request

Cuando esté listo:
1. Crea un PR de `frontend-nuevo` → `master`
2. El equipo revisará
3. Se hará merge cuando esté aprobado

---

## 📦 Estructura Sugerida

```
DKP/
├── backend/                    # Backend (ya existe en master)
│   ├── server.js
│   ├── database.js
│   └── ...
│
└── frontend-new/               # Tu nuevo frontend
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   ├── hooks/
    │   ├── services/
    │   │   └── api.js         # Cliente API para backend
    │   ├── contexts/
    │   ├── utils/
    │   └── App.jsx
    ├── public/
    ├── package.json
    └── vite.config.js
```

---

## 🔐 Autenticación

### Flujo de Login

```javascript
// 1. Usuario hace login
const response = await api.post('/api/auth/login', {
  username: 'admin',
  password: 'admin123'
});

// 2. Guardar token
localStorage.setItem('token', response.data.token);
localStorage.setItem('user', JSON.stringify(response.data.user));

// 3. El interceptor de axios lo incluirá automáticamente
// en todas las peticiones subsiguientes
```

### Usuario de Prueba

```
Username: admin
Password: admin123
```

Otros usuarios: password `123`
- worm, lolilop, harley, shampi, booque, tanquelol, holypete, frostmage

---

## 🐛 Debugging

### Ver logs del backend

```bash
docker logs -f dkp-backend
```

### Verificar endpoints

```bash
# Health check
curl http://localhost:3000/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get members (con token)
curl http://localhost:3000/api/members \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📞 Contacto

Si tienes dudas sobre:
- **Backend/API**: Revisar documentación en `/README.md`
- **Warcraft Logs**: Ver `/WARCRAFTLOGS_INTEGRATION.md`
- **Deploy**: Ver `/DEPLOY.md`

---

## ✅ Checklist para el Nuevo Frontend

- [ ] Crear rama `frontend-nuevo`
- [ ] Inicializar proyecto (Vite/Next/Remix)
- [ ] Configurar API client con axios
- [ ] Implementar login/logout
- [ ] Probar conexión con backend
- [ ] Diseñar mockups en Figma
- [ ] Implementar componentes base
- [ ] Testing con usuarios de prueba
- [ ] Documentar componentes
- [ ] Crear Pull Request

---

**¡Buena suerte con el desarrollo! 🚀**

Si necesitan ayuda, revisen el frontend provisional como referencia
pero recuerden que tienen total libertad para crear algo mejor.
