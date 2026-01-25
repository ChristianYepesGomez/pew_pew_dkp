# World of Warcraft: Cataclysm - Especializaciones por Clase

Este documento lista todas las especializaciones disponibles para cada clase en WoW Cataclysm.

## Death Knight (Caballero de la Muerte)
- **Blood** (Sangre) - Tank/DPS
- **Frost** (Escarcha) - DPS
- **Unholy** (Profano) - DPS

## Druid (Druida)
- **Balance** (Equilibrio) - DPS Caster
- **Feral** (Feral) - Tank/DPS Melee
- **Restoration** (Restauración) - Healer

## Hunter (Cazador)
- **Beast Mastery** (Maestría de Bestias) - DPS
- **Marksmanship** (Puntería) - DPS
- **Survival** (Supervivencia) - DPS

## Mage (Mago)
- **Arcane** (Arcano) - DPS
- **Fire** (Fuego) - DPS
- **Frost** (Escarcha) - DPS

## Paladin (Paladín)
- **Holy** (Sagrado) - Healer
- **Protection** (Protección) - Tank
- **Retribution** (Reprensión) - DPS

## Priest (Sacerdote)
- **Discipline** (Disciplina) - Healer
- **Holy** (Sagrado) - Healer
- **Shadow** (Sombra) - DPS

## Rogue (Pícaro)
- **Assassination** (Asesinato) - DPS
- **Combat** (Combate) - DPS
- **Subtlety** (Sutileza) - DPS

## Shaman (Chamán)
- **Elemental** (Elemental) - DPS Caster
- **Enhancement** (Mejora) - DPS Melee
- **Restoration** (Restauración) - Healer

## Warlock (Brujo)
- **Affliction** (Aflicción) - DPS
- **Demonology** (Demonología) - DPS
- **Destruction** (Destrucción) - DPS

## Warrior (Guerrero)
- **Arms** (Armas) - DPS
- **Fury** (Furia) - DPS
- **Protection** (Protección) - Tank

---

## Mapping Rol por Especialización

### Tank Specs
- Death Knight: Blood
- Druid: Feral
- Paladin: Protection
- Warrior: Protection

### Healer Specs
- Druid: Restoration
- Paladin: Holy
- Priest: Discipline, Holy
- Shaman: Restoration

### DPS Specs
- Todas las demás especializaciones

---

## Nombres en Español e Inglés

Para multi-idioma, aquí están los nombres en ambos idiomas:

```json
{
  "deathknight": {
    "blood": { "en": "Blood", "es": "Sangre" },
    "frost": { "en": "Frost", "es": "Escarcha" },
    "unholy": { "en": "Unholy", "es": "Profano" }
  },
  "druid": {
    "balance": { "en": "Balance", "es": "Equilibrio" },
    "feral": { "en": "Feral", "es": "Feral" },
    "restoration": { "en": "Restoration", "es": "Restauración" }
  },
  "hunter": {
    "beastmastery": { "en": "Beast Mastery", "es": "Maestría de Bestias" },
    "marksmanship": { "en": "Marksmanship", "es": "Puntería" },
    "survival": { "en": "Survival", "es": "Supervivencia" }
  },
  "mage": {
    "arcane": { "en": "Arcane", "es": "Arcano" },
    "fire": { "en": "Fire", "es": "Fuego" },
    "frost": { "en": "Frost", "es": "Escarcha" }
  },
  "paladin": {
    "holy": { "en": "Holy", "es": "Sagrado" },
    "protection": { "en": "Protection", "es": "Protección" },
    "retribution": { "en": "Retribution", "es": "Reprensión" }
  },
  "priest": {
    "discipline": { "en": "Discipline", "es": "Disciplina" },
    "holy": { "en": "Holy", "es": "Sagrado" },
    "shadow": { "en": "Shadow", "es": "Sombra" }
  },
  "rogue": {
    "assassination": { "en": "Assassination", "es": "Asesinato" },
    "combat": { "en": "Combat", "es": "Combate" },
    "subtlety": { "en": "Subtlety", "es": "Sutileza" }
  },
  "shaman": {
    "elemental": { "en": "Elemental", "es": "Elemental" },
    "enhancement": { "en": "Enhancement", "es": "Mejora" },
    "restoration": { "en": "Restoration", "es": "Restauración" }
  },
  "warlock": {
    "affliction": { "en": "Affliction", "es": "Aflicción" },
    "demonology": { "en": "Demonology", "es": "Demonología" },
    "destruction": { "en": "Destruction", "es": "Destrucción" }
  },
  "warrior": {
    "arms": { "en": "Arms", "es": "Armas" },
    "fury": { "en": "Fury", "es": "Furia" },
    "protection": { "en": "Protection", "es": "Protección" }
  }
}
```

---

## Notas de Implementación

1. **Registro de usuarios**: El formulario de registro debe mostrar las specs disponibles según la clase seleccionada
2. **Validación**: Asegurarse de que la combinación clase-spec sea válida
3. **Auto-detección de rol**: Se puede inferir el rol (Tank/Healer/DPS) basado en la especialización
4. **Warcraft Logs**: La API de WCL devuelve la spec del jugador, se puede usar para auto-completar este campo

---

**Última actualización:** 2026-01-23
