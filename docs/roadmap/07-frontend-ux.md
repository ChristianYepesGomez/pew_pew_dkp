# Brief 07: Frontend UX Improvements

## Prioridad: MEDIA
## Esfuerzo estimado: 3-5 dias
## Fase: Product-Ready

---

## Contexto
El frontend esta bien construido con React + Tailwind, dark theme pulido, y buen uso de React Query + Socket.IO. Pero para ser producto necesita mejoras en accesibilidad, mobile, validacion de formularios, y patrones UX consistentes.

---

## Tareas

### 1. Accesibilidad (a11y) — Impacto alto

#### 1.1 ARIA Labels
- **Archivos**: Todos los componentes con botones/inputs
- **Problema**: Faltan `aria-label` en botones de icono, inputs sin labels asociados
- **Accion**:
  - Botones con solo icono: agregar `aria-label="Close"`, `aria-label="Place bid"`, etc
  - Inputs: agregar `<label htmlFor>` o `aria-label`
  - Modales: agregar `role="dialog"` y `aria-modal="true"`

#### 1.2 Focus Management en Modales
- **Archivos**: Todos los modales (`*Modal.jsx`)
- **Problema**: Al abrir modal, focus no se mueve al modal. Al cerrar, no regresa al trigger
- **Solucion**: Usar focus trap (implementar custom hook `useFocusTrap` o usar `@headlessui/react`)

#### 1.3 Keyboard Navigation
- **Problema**: Tab order no gestionado, Escape no cierra modales consistentemente
- **Accion**:
  - Escape cierra cualquier modal abierto
  - Tab navega dentro del modal (no escapa)
  - Enter confirma acciones primarias

#### 1.4 Color-Only Indicators
- **Problema**: Status indicators (vault complete, DKP levels) usan solo color
- **Accion**: Agregar iconos o texto complementario para usuarios con daltonismo

### 2. Mobile Responsiveness

#### 2.1 Mobile Navigation
- **Archivo**: `src/components/Header.jsx`
- **Problema**: No hay hamburger menu ni mobile nav drawer
- **Accion**: Implementar menu hamburger para mobile con slide-out drawer
- **Incluir**: Tab navigation del Dashboard (actualmente horizontal tabs que no caben en mobile)

#### 2.2 Touch Targets
- **Problema**: Algunos botones/links son muy pequenos para touch (<44px)
- **Accion**: Asegurar min 44x44px en todos los elementos interactivos (WCAG 2.5.5)

#### 2.3 Modales Responsive
- **Archivos**: `ArmoryModal.jsx`, `PerformanceModal.jsx`, `CreateAuctionModal.jsx`
- **Problema**: Algunos modales no se adaptan a pantallas pequenas
- **Accion**: Full-screen modales en mobile (`md:max-w-lg` + `max-sm:inset-0`)

#### 2.4 Tables en Mobile
- **Archivos**: `MembersTab.jsx`, `HistoryTab.jsx`
- **Problema**: Tablas con muchas columnas se desbordan en mobile
- **Opciones**:
  - A) Card layout en mobile (detectar breakpoint)
  - B) Horizontal scroll con sticky first column
  - C) Mostrar solo columnas esenciales en mobile

### 3. Form Validation

#### 3.1 Real-time Validation
- **Archivos**: `Register.jsx`, `BidModal.jsx`, `CreateAuctionModal.jsx`, `DKPAdjustModal.jsx`
- **Problema**: Validacion solo al submit, sin feedback inmediato
- **Accion**: Validar on-blur para campos criticos:
  - Email format
  - Password strength (minimo 8 chars, mostrar strength meter)
  - Bid amount (>= current + 1, <= available DKP)
  - DKP amount (numeric, within bounds)

#### 3.2 Field-Level Error Messages
- **Problema**: Errores genericos en alert o toast, no inline al campo
- **Accion**: Mostrar error debajo del campo con rojo + mensaje descriptivo

### 4. Component Consistency

#### 4.1 Toast/Notification System Global
- **Problema**: Inconsistente — algunos tabs usan inline alerts, otros banner, otros nada
- **Accion**: Implementar sistema global de toast notifications:
  - Crear `ToastContext` + `ToastContainer` component
  - Types: success, error, warning, info
  - Auto-dismiss con timer
  - Stackable (multiples toasts)
  - Reemplazar todos los `alert()` y inline messages

#### 4.2 Modal Pattern Unificado
- **Problema**: Algunos modales usan `Portal.jsx`, otros inline
- **Accion**: Estandarizar: todos los modales usan Portal + backdrop click to close + Escape + focus trap

#### 4.3 Loading State Naming
- **Problema**: Inconsistente: `loading`, `isLoading`, `_loading`
- **Accion**: Estandarizar a `isLoading` (patron React Query)

### 5. Performance Frontend

#### 5.1 Virtualizacion de Listas
- **Archivos**: `MembersTab.jsx`, analytics data
- **Problema**: Listas grandes (100+ members) renderizan todos los DOM nodes
- **Solucion**: Usar `@tanstack/react-virtual` para virtualizar listas >50 items

#### 5.2 Lazy Loading de Tabs
- **Archivo**: `src/pages/Dashboard.jsx`
- **Actual**: React Query ya prefetcha on hover (bueno)
- **Mejora**: Lazy load el component code de cada tab con `React.lazy()`:
```javascript
const AnalyticsTab = React.lazy(() => import('../components/AnalyticsTab'));
```

### 6. Internacionalizacion Completa

#### 6.1 Strings Hardcoded
- **Problema**: WCL import, sound settings, y algunos modales tienen texto en ingles hardcoded
- **Accion**: Audit de todos los strings, mover a `utils/translations.js`

#### 6.2 Date/Number Formatting
- **Problema**: Fechas en ISO format, numeros sin formato locale
- **Accion**: Usar `Intl.DateTimeFormat` y `Intl.NumberFormat` basado en language context

### 7. Error Recovery UX

#### 7.1 Network Error UI
- **Problema**: Si la API falla, no hay retry button ni mensaje amigable
- **Accion**: React Query `onError` + componente `ErrorBoundary` con:
  - Mensaje amigable
  - Boton "Retry"
  - Link a status page (futuro)

#### 7.2 Offline Detection
- **Accion**: `navigator.onLine` listener + banner "You're offline" cuando se pierde conexion

---

## Archivos principales a modificar
- `src/components/Header.jsx` — mobile nav
- `src/pages/Dashboard.jsx` — lazy loading
- `src/components/*Modal.jsx` — todos los modales
- `src/components/MembersTab.jsx` — virtualizacion
- `src/utils/translations.js` — strings faltantes
- Crear: `src/components/Toast.jsx` + `src/context/ToastContext.jsx`
- Crear: `src/hooks/useFocusTrap.js`

## Verificacion
- [ ] Lighthouse accessibility score >= 80
- [ ] Mobile: app usable en 375px width (iPhone SE)
- [ ] Modal: Escape cierra, Tab trapped, focus returns
- [ ] Forms: errores inline en campos invalidos
- [ ] Toast system funcional en todas las tabs
- [ ] Virtualizacion: 200 members renderiza fluido
- [ ] i18n: zero strings hardcoded en ingles (cuando language = ES)
