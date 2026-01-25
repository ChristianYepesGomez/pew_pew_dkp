# 🚀 Guía de Despliegue - DKP System

## Opciones de Hosting Gratuito

Después de investigar las mejores opciones para 2025, aquí están mis recomendaciones:

### 🏆 **Recomendación Principal: Render.com**

| Característica | Detalle |
|----------------|---------|
| **Precio** | Gratis (Free Tier) |
| **Docker** | ✅ Soporte nativo |
| **Base de datos** | SQLite con disco persistente |
| **SSL** | ✅ Automático |
| **Dominio custom** | ✅ Gratis |
| **Limitación** | Se "duerme" tras 15min de inactividad |

**Por qué Render:**
- No requiere tarjeta de crédito
- Despliegue automático desde GitHub
- Soporte nativo para Node.js y Docker
- Disco persistente para SQLite (perfecto para nuestro caso)

---

## 📋 Guía Paso a Paso: Desplegar en Render

### 1. Preparar el Repositorio

```bash
# Inicializar git (si no lo has hecho)
cd dkp-backend
git init
git add .
git commit -m "Initial commit"

# Crear repositorio en GitHub y subir
git remote add origin https://github.com/TU_USUARIO/dkp-backend.git
git push -u origin main
```

### 2. Crear Cuenta en Render

1. Ve a [render.com](https://render.com)
2. Click en **"Get Started for Free"**
3. Regístrate con tu cuenta de GitHub (recomendado)

### 3. Crear el Servicio Web

1. En el Dashboard, click en **"New +"** → **"Web Service"**
2. Conecta tu repositorio de GitHub
3. Selecciona el repositorio `dkp-backend`
4. Configura:

| Campo | Valor |
|-------|-------|
| Name | `dkp-backend` |
| Region | Frankfurt (o la más cercana) |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node server.js` |
| Instance Type | `Free` |

### 4. Configurar Variables de Entorno

En la sección **"Environment"**, añade:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Click en "Generate" para crear uno seguro |
| `PORT` | `3000` |

### 5. Añadir Disco Persistente (para SQLite)

1. Ve a la pestaña **"Disks"** del servicio
2. Click en **"Add Disk"**
3. Configura:

| Campo | Valor |
|-------|-------|
| Name | `dkp-data` |
| Mount Path | `/app/data` |
| Size | `1 GB` |

4. Click en **"Save"**

### 6. Desplegar

Click en **"Create Web Service"**. Render:
1. Clonará tu repositorio
2. Ejecutará `npm install`
3. Iniciará el servidor

**Tu API estará disponible en:** `https://dkp-backend.onrender.com`

---

## ⚡ Solucionar el "Cold Start" (Spin Down)

El Free Tier de Render "duerme" tu servicio tras 15 minutos sin tráfico. Para mantenerlo activo:

### Opción 1: Cron-job.org (Gratis)

1. Ve a [cron-job.org](https://cron-job.org)
2. Crea una cuenta gratuita
3. Crea un nuevo cron job:
   - **URL:** `https://tu-app.onrender.com/health`
   - **Intervalo:** Cada 14 minutos
   - **Método:** GET

### Opción 2: UptimeRobot (Gratis)

1. Ve a [uptimerobot.com](https://uptimerobot.com)
2. Crea un monitor HTTP(s)
3. Configura para hacer ping cada 5 minutos

---

## 🐳 Desarrollo Local con Docker

### Requisitos
- Docker Desktop instalado
- IntelliJ IDEA con plugin de Docker

### Ejecutar con Docker Compose

```bash
# Construir y ejecutar
docker-compose up --build

# Ejecutar en background
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Parar y borrar datos
docker-compose down -v
```

### Ejecutar desde IntelliJ

1. Abre el proyecto en IntelliJ
2. Ve a **Run → Edit Configurations**
3. Las configuraciones ya están creadas:
   - `DKP Backend - Dev` → Ejecuta Node.js directamente
   - `DKP Backend - Docker` → Ejecuta en contenedor

---

## 🔄 Alternativas de Hosting

### Railway.app
- **Precio:** $5/mes de crédito gratis
- **Pros:** Muy fácil, auto-detecta Node.js
- **Cons:** Requiere tarjeta de crédito

### Fly.io
- **Precio:** Tier gratuito limitado
- **Pros:** Multi-región, bajo latencia
- **Cons:** Más complejo, requiere CLI

### Vercel
- **Precio:** Gratis para frontend
- **Pros:** Perfecto para el frontend React
- **Cons:** No ideal para backends con WebSockets

### DigitalOcean App Platform
- **Precio:** Desde $5/mes
- **Pros:** Muy estable, buen soporte
- **Cons:** No tiene free tier para backend

---

## 📊 Arquitectura Recomendada

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCCIÓN                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ┌─────────────┐         ┌─────────────────────────┐  │
│   │   Vercel    │         │      Render.com         │  │
│   │  (Frontend) │ ──────▶ │      (Backend API)      │  │
│   │   React     │   API   │    Node.js + SQLite     │  │
│   │    Free     │         │         Free            │  │
│   └─────────────┘         └─────────────────────────┘  │
│                                    │                    │
│                           ┌────────┴────────┐          │
│                           │  Disco 1GB      │          │
│                           │  (SQLite DB)    │          │
│                           └─────────────────┘          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Coste total: $0/mes** 🎉

---

## 🔐 Checklist de Seguridad para Producción

- [ ] Cambiar `JWT_SECRET` a un valor seguro (Render lo genera)
- [ ] Cambiar contraseña del admin por defecto
- [ ] Configurar CORS con tu dominio frontend específico
- [ ] Activar HTTPS (Render lo hace automático)
- [ ] Configurar rate limiting (opcional pero recomendado)
- [ ] Hacer backups periódicos del archivo SQLite

---

## 📞 Troubleshooting

### El servicio no arranca
```bash
# Ver logs en Render Dashboard → Logs
# O localmente:
docker-compose logs backend
```

### Error de base de datos
```bash
# Verificar que el disco está montado
ls -la /app/data/
```

### WebSockets no funcionan
- Verifica que CORS está configurado correctamente
- Render soporta WebSockets en el free tier ✅

---

**¿Preguntas?** Abre un issue en el repositorio.

**For the Horde! ⚔️ For the Alliance!**
