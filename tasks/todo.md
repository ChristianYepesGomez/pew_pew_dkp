# DKP System - Task Management

> Última actualización: 2025-02-05

---

## Flujo de Trabajo

### 1. Modo Planificación por Defecto
- Entrar en modo planificación para CUALQUIER tarea no trivial (más de 3 pasos o decisiones arquitectónicas)
- Si algo sale mal, PARAR y volver a planificar de inmediato; no seguir forzando
- Usar el modo planificación para los pasos de verificación, no solo para la construcción
- Escribir especificaciones detalladas por adelantado para reducir la ambigüedad

### 2. Estrategia de Subagentes
- Usar subagentes con frecuencia para mantener limpia la ventana de contexto principal
- Delegar la investigación, exploración y análisis paralelo a subagentes
- Para problemas complejos, dedicar más capacidad de cómputo mediante subagentes
- Una tarea por subagente para una ejecución focalizada

### 3. Bucle de Automejora
- Tras CUALQUIER corrección del usuario: actualizar `tasks/lessons.md` con el patrón
- Escribir reglas para ti mismo que eviten el mismo error
- Iterar implacablemente sobre estas lecciones hasta que la tasa de errores disminuya
- Revisar las lecciones al inicio de la sesión para el proyecto correspondiente

### 4. Verificación antes de Finalizar
- Nunca marcar una tarea como completada sin demostrar que funciona
- Comparar la diferencia (diff) de comportamiento entre la rama principal y tus cambios cuando sea relevante
- Pregúntate: "¿Aprobaría esto un ingeniero senior (Staff Engineer)?"
- Ejecutar tests, comprobar los logs y demostrar la corrección del código

### 5. Exigir Elegancia (Equilibrado)
- Para cambios no triviales: hacer una pausa y preguntar "¿hay una forma más elegante?"
- Si un arreglo parece un parche (hacky): "Sabiendo todo lo que sé ahora, implementar la solución elegante"
- Omitir esto para arreglos simples y obvios; no hacer sobreingeniería
- Cuestionar tu propio trabajo antes de presentarlo

### 6. Corrección de Errores Autónoma
- Cuando recibas un informe de error: simplemente arréglalo. No pidas que te lleven de la mano
- Identificar logs, errores o tests que fallan y luego resolverlos
- Cero necesidad de cambio de contexto por parte del usuario
- Ve a arreglar los tests de CI que fallan sin que te digan cómo

---

## Tareas Actuales

### Completadas ✅

- [x] Bosses Tab con estadísticas de raid y métricas extendidas de WCL
- [x] Nuevo servicio raids.js con datos estáticos de raid/boss
- [x] Tablas de base de datos para estadísticas de boss, rendimiento de jugadores, récords
- [x] Integración con Mythic Trap CDN para artwork de bosses
- [x] Merge a master y deploy (backend + frontend)
- [x] Crear estructura tasks/ con lessons.md y todo.md

### Pendientes 📋

> Añadir tareas aquí cuando el usuario las solicite

---

## Próximas Features (Roadmap del Plan)

| # | Feature | Prioridad | Estado |
|---|---------|-----------|--------|
| 1 | WCL Logs + Calendar Integration | Alta | ✅ Completado |
| 2 | Calendar alert for unconfirmed days | Media | Pendiente |
| 3 | Admin calendar table view for all members | Media | Pendiente |
| 4 | DKP history with item icons/tooltips | Media | Pendiente |
| 5 | Security audit & cleanup | Media | Pendiente |
| 6 | Registration system | Media | Pendiente |
| 7 | Profile redesign | Media | Pendiente |
| 8 | Profile pictures | Baja | Pendiente |
| 9 | Configurable raid days (admin UI) | Baja | Pendiente |
| 10 | Class hover effects | Baja | Pendiente |
| 11 | Random buff system on roster | Baja | Pendiente |

---

## Sección de Revisión

> Añadir notas de revisión después de completar tareas significativas

### 2025-02-05 - Boss Statistics Feature
- **Qué se hizo**: Nueva pestaña Bosses con cards cinematográficas, estadísticas de WCL, récords de top damage/healing
- **Archivos clave**: `services/raids.js`, `database.js`, `server.js`, `BossesTab.jsx`
- **Lecciones aprendidas**: Documentadas en lessons.md
- **Estado del deploy**: ✅ Backend (Render) + Frontend (Vercel) desplegados
