# Display & UI Conventions

## Character Display
- Siempre mostrar **main character name** como nombre principal, no el nombre del alt

## Difficulty Colors
| Difficulty | Color |
|-----------|-------|
| Mythic | `#ff8000` |
| Heroic | `#a335ee` |
| Normal | `#1eff00` |
| LFR | `#0070dd` |

## Class Colors
Defined in frontend: `src/utils/classColors.js`

## Tables
- Responsive: ocultar columnas en mobile con `hidden sm:table-cell`

## Fonts
- `font-cinzel` para titulos importantes (boss names, headers)

## Avatars
- Compress to 400x400px, max 150KB
- Characters imported via Blizzard OAuth
- Boss images cached and preserved when raids go legacy
