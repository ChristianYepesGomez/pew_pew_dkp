# Lecciones Aprendidas - DKP System

> Revisar este archivo al inicio de cada sesión.

---

## Principios Fundamentales

- **Simplicidad Primero**: Cada cambio debe ser lo más simple posible. Afectar el mínimo código necesario.
- **Sin Pereza**: Encontrar las causas raíz. Nada de arreglos temporales. Estándares de desarrollador senior.
- **Impacto Mínimo**: Los cambios solo deben tocar lo necesario. Evitar introducir errores.

---

## Lecciones del Proyecto

### Git & Deploys

| Fecha | Lección | Contexto |
|-------|---------|----------|
| 2025-02-05 | **Siempre hacer merge a `master` para que Render despliegue** | Los commits en `backend-dev` no activan deploy automático. Render solo escucha `master`. |
| 2025-02-05 | **Frontend también necesita merge a `master`** | Vercel/Netlify despliegan desde `master`, no desde `frontend-dev`. |
| 2025-02-05 | **Resolver conflictos de merge con `git checkout --theirs`** cuando el branch de feature es la fuente de verdad | package-lock.json suele generar conflictos; tomar la versión del feature branch. |

### Backend

| Fecha | Lección | Contexto |
|-------|---------|----------|
| 2025-02-05 | **Matar procesos node antes de reiniciar**: `taskkill //F //IM node.exe` | Error EADDRINUSE en puerto 3000 cuando el proceso anterior no terminó. |
| 2025-02-05 | **WCL API usa GraphQL con aliases para múltiples tablas** | `damage: table(dataType: DamageDone, ...)` permite obtener damage, healing, deaths en una sola query. |
| 2025-02-05 | **Normalizar dificultad de WCL**: mapear números (3,4,5) a strings (Normal, Heroic, Mythic) | WCL devuelve dificultad como número, la DB espera string. |

### Frontend

| Fecha | Lección | Contexto |
|-------|---------|----------|
| 2025-02-05 | **Mythic Trap CDN para imágenes de bosses de alta calidad** | URL: `https://assets2.mythictrap.com/{raid-slug}/background_finals/{boss-slug}-custom.png?v=9` |
| 2025-02-05 | **Diseño cinematic para boss cards**: imagen full-bleed + gradient overlay + texto encima | Las imágenes de Wowhead journal son de baja calidad; usar Mythic Trap. |

### Datos de WoW

| Fecha | Lección | Contexto |
|-------|---------|----------|
| 2025-02-05 | **Manaforge Omega es tier 3, WCL zone ID 44** | Encounter IDs: 3129 (Plexus), 3131 (Loom'ithar), 3130 (Soulbinder), 3132 (Forgeweaver), 3122 (Soul Hunters), 3133 (Fractillus), 3134 (Nexus-King), 3135 (Dimensius) |
| 2025-02-05 | **The Soul Hunters es boss opcional** (mini-boss) | Marcar con `optional: true` en la definición. |

---

## Reglas Auto-impuestas

1. **Antes de marcar tarea como completada**: verificar que funciona (run tests, check logs, manual verification).
2. **Ante un error**: investigar y arreglar autónomamente sin preguntar "¿qué hago?".
3. **Cambios no triviales**: pausar y preguntar "¿hay una forma más elegante?".
4. **Cada corrección del usuario**: añadir entrada a este archivo.
5. **Merge a master**: siempre después de completar features para activar deploys.

---

## Errores Comunes a Evitar

- [ ] Commitear a branch de desarrollo y olvidar merge a master
- [ ] No verificar que el servidor reinició correctamente
- [ ] Asumir que WCL devuelve datos en el formato esperado sin validar
- [ ] Usar imágenes de baja calidad cuando hay alternativas mejores disponibles
