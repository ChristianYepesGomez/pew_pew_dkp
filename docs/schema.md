# Data Model Rules

## User Roles
- `admin` - Control total
- `officer` - Gestion de raids y DKP
- `raider` - Usuario normal

## Key Relationships
- **Main character vs alts**: Cada usuario tiene un `character_name` principal en `users` table. Los alts estan en `characters` table. En toda la UI siempre mostrar el **main character** como nombre principal, nunca el alt.
- **Boss stats por dificultad**: Siempre separadas por difficulty (Mythic/Heroic/Normal/LFR). NUNCA mezclar stats de diferentes dificultades. Mostrar la mas alta por defecto.
- **Raid roles**: Tank, Healer, DPS. Se asignan segun la spec del personaje. Los buffs del buff manager se filtran por `casterRole`.
- **WCL fights**: `killType: Encounters` en el API de WCL devuelve TODAS las encounters (kills Y wipes). El campo `kill` boolean indica si fue kill o wipe.
- **Raid weeks** empiezan en jueves (Thursday-Wednesday).

## Database
- **Engine**: Turso (libsql) - SQLite distribuido en la nube
- **Schema**: Defined in `database.js` via migrations
- **Local dev**: `dkp.db` (gitignored)
