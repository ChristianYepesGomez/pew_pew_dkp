# Brief 11: Mobile PWA

## Prioridad: MEDIA
## Esfuerzo estimado: 3-5 dias
## Fase: Product-Ready

---

## Contexto
Los raiders checkean DKP, confirman asistencia, y pujan en subastas desde el movil. El frontend ya es parcialmente responsive (Tailwind breakpoints), pero no es PWA: no se puede instalar, no funciona offline, y no tiene push notifications.

Convertirlo en PWA es relativamente poco esfuerzo con alto impacto en la experiencia mobile.

---

## Tareas

### 1. Service Worker + Manifest
- **Archivo**: `public/manifest.json`
```json
{
    "name": "DKP Manager - Guild Loot System",
    "short_name": "DKP",
    "description": "Guild DKP, auctions, and raid management",
    "start_url": "/",
    "display": "standalone",
    "background_color": "#0f0a1e",
    "theme_color": "#4a1a8f",
    "icons": [
        { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
        { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
    ]
}
```

- **Service Worker** (`public/sw.js` o via vite-plugin-pwa):
  - Cache static assets (JS, CSS, images, fonts)
  - Network-first for API calls
  - Offline fallback page
  - Background sync for failed bids (queue and retry)

- **Plugin recomendado**: `vite-plugin-pwa` — genera SW automaticamente con Workbox

### 2. Install Prompt
- **Archivo**: `src/components/InstallPrompt.jsx`
- Detectar `beforeinstallprompt` event
- Mostrar banner sutil: "Install DKP Manager for quick access"
- Guardar preferencia si usuario dismisses

### 3. Push Notifications (Web Push)
- **Backend**: Nuevo endpoint para registrar push subscriptions
```
POST /api/notifications/subscribe    -- registrar push subscription
DELETE /api/notifications/subscribe  -- desregistrar
PUT /api/notifications/preferences   -- configurar que notificaciones recibir
```

- **Tabla nueva**:
```sql
CREATE TABLE push_subscriptions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

- **Eventos push**:
  - Outbid en subasta
  - Subasta que te interesa (BIS) creada
  - Raid en 1 hora (si confirmaste asistencia)
  - DKP ajustado
  - Nueva decision de loot council (si aplica)

- **Dependencia**: `web-push` npm package (VAPID keys)

### 4. Offline Experience
- **Cache**: Dashboard layout, ultimo estado de members, ultimo DKP
- **Queue**: Si usuario hace bid offline, queue y retry cuando vuelva conexion
- **UI**: Banner "You're offline — some features limited"
- **Nota**: No intentar full offline — solo cache de lectura + queue de escritura

### 5. App-Like Navigation
- **Bottom Navigation Bar** (mobile only):
```
[Members] [Auctions] [Calendar] [Stats] [More]
```
- Reemplaza tab bar horizontal del Dashboard en mobile
- Fixed al bottom, icons + labels
- Badge con numero de auctions activas

### 6. Performance Optimizations para Mobile
- **Images**: Lazy loading para avatars y item icons
- **Fonts**: Preload Cinzel font, subset solo caracteres usados
- **Bundle**: Code splitting por tab (React.lazy ya mencionado en brief 07)
- **Animations**: Reducir/desactivar en `prefers-reduced-motion`

### 7. Icons para PWA
- Generar icons desde el CatLogo existente
- Sizes: 72, 96, 128, 144, 152, 192, 384, 512
- Apple touch icon
- Splash screens para iOS

---

## Vite PWA Plugin Setup

```javascript
// vite.config.js
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'robots.txt'],
            manifest: {
                name: 'DKP Manager',
                short_name: 'DKP',
                theme_color: '#4a1a8f',
                // ... resto del manifest
            },
            workbox: {
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/api\./,
                        handler: 'NetworkFirst',
                        options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 300 } }
                    },
                    {
                        urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
                        handler: 'CacheFirst',
                        options: { cacheName: 'image-cache', expiration: { maxEntries: 100, maxAgeSeconds: 86400 } }
                    }
                ]
            }
        })
    ]
});
```

---

## Archivos a crear/modificar
- Crear: `public/manifest.json`
- Crear: `src/components/InstallPrompt.jsx`
- Crear: `src/components/BottomNav.jsx`
- Crear: `src/components/OfflineBanner.jsx`
- Crear (backend): `routes/notifications.js`
- Modificar: `vite.config.js` — agregar VitePWA
- Modificar: `index.html` — meta tags PWA, manifest link
- Modificar: `src/pages/Dashboard.jsx` — bottom nav en mobile
- Modificar: `server.js` — mount notifications route

## Dependencias
- Frontend: `vite-plugin-pwa`
- Backend: `web-push`
- Assets: Icon set en multiples resoluciones

## Verificacion
- [ ] Lighthouse PWA score >= 90
- [ ] App instalable en Chrome (desktop + mobile) y Safari (iOS)
- [ ] Push notifications llegan cuando outbid
- [ ] Offline: puede ver ultimo estado, banner informativo
- [ ] Bottom nav funcional en mobile (<768px)
- [ ] Performance: First Contentful Paint < 2s en 3G
