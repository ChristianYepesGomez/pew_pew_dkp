# Brief 12: Onboarding & Go-to-Market

## Prioridad: ALTA (si quieres producto)
## Esfuerzo estimado: 1-2 semanas
## Fase: Market Launch

---

## Contexto
Tu herramienta tiene mas features que cualquier competidor, pero eso no importa si nadie la conoce. Este brief cubre: onboarding para nuevos guilds, landing page, y estrategia de lanzamiento.

---

## Parte 1: Onboarding Wizard

### El problema
Un guild master llega a tu app. Que hace? Actualmente: registrarse, y luego... que? Necesita un flujo guiado que lo lleve de "acabo de registrarme" a "mi guild esta operativa" en 10 minutos.

### Flujo propuesto (5 pasos)

#### Paso 1: Crear Guild
```
"Welcome! Let's set up your guild."
- Guild name: [Pew Pew Kittens with Guns]
- Server/Realm: [Sanguino-EU]
- Region: [EU] / [US] / [KR] / [TW]
- Loot system: [DKP] / [Loot Council] / [EPGP]
[Continue →]
```

#### Paso 2: Importar Roster
```
"Let's add your raiders."
Option A: Import from WarcraftLogs (recommended)
  - Enter your guild's WCL page URL
  - Auto-fetch roster from recent logs
Option B: Import from Blizzard (guild roster API)
  - Connect Blizzard account
  - Select characters from guild roster
Option C: Manual
  - Add members one by one
  - Bulk CSV upload
[Skip for now] [Continue →]
```

#### Paso 3: Conectar WarcraftLogs
```
"Connect WarcraftLogs for automatic raid imports."
- WCL Client ID: [...]
- WCL Client Secret: [...]
- [How to get these →] (link a tutorial/docs)
[Skip for now] [Continue →]
```

#### Paso 4: Configurar Raids
```
"When does your guild raid?"
- Day 1: [Wednesday] [20:00 - 23:00]
- Day 2: [Thursday] [20:00 - 23:00]
- [+ Add another day]
[Skip for now] [Continue →]
```

#### Paso 5: Invite Members
```
"Share this link with your raiders:"
https://dkp.app/join/abc123
- Or copy invite link for Discord
- QR code for mobile
[Go to Dashboard →]
```

### Implementacion
- **Frontend**: `src/pages/Onboarding.jsx` — wizard component con steps
- **Backend**: `routes/onboarding.js` — endpoints especificos para setup
- **State**: Guardar `onboarding_completed` en guild settings
- **Skip**: Cada paso es skippable, wizard accesible despues desde settings

---

## Parte 2: Landing Page

### Estructura

#### Hero Section
```
"The All-in-One Guild Management Platform"
DKP tracking, real-time auctions, WarcraftLogs integration,
performance analytics, and raid scheduling — in one place.

[Get Started Free] [See Demo]
```
- Background: Dark theme con particles/nebula (match app aesthetic)
- Screenshot/mockup del dashboard

#### Feature Showcase (4-6 cards)
1. **DKP & Auctions** — "Real-time bidding with anti-snipe protection"
2. **WarcraftLogs Integration** — "Auto-import raids, track performance, award DKP"
3. **Analytics** — "Guild superlatives, attendance trends, DKP economy"
4. **Calendar** — "Raid scheduling with signup confirmations and DKP bonuses"
5. **BIS Lists** — "Personal wishlists with paper doll visualization"
6. **Discord Bot** — "Manage your guild without leaving Discord"

#### Social Proof
- "Used by X guilds across Y servers" (cuando tengas datos)
- Testimonials de tu propia guild como early adopter

#### Pricing
```
Free                    Premium ($4/month/guild)
- DKP tracking          Everything in Free, plus:
- Roster management     - WarcraftLogs integration
- Calendar & signups    - Discord bot
- BIS lists             - Advanced analytics
- Up to 30 members      - Unlimited members
                        - Data export
                        - Priority support
```

#### Footer
- Links: Docs, GitHub (si open source), Discord community, Contact
- Legal: Terms, Privacy

### Tech
- Puede ser pagina estatica (Next.js, Astro, o incluso HTML puro)
- Separada del app (different deploy/domain o subdomain)
- SEO optimized: meta tags, OG images, structured data

---

## Parte 3: Go-to-Market Strategy

### Fase 1: Tu propia guild (ya hecho)
- Dogfooding completo
- Feedback real de raiders
- Screenshots y testimonials

### Fase 2: Community guilds (mes 1)
- **Reddit**: Post en r/wow, r/wowguilds, r/CompetitiveWoW
  - No "buy my product" — post estilo "I built this for my guild, thought others might find it useful"
  - Include screenshots, explain pain points it solves
- **WoW Forums**: EU y US official forums, secciones de guilds
- **Discord servers**: Grandes servers de WoW (WoWHead, Method, class discords)
  - Contribuir genuinamente antes de promocionar

### Fase 3: Content & SEO (mes 2-3)
- **Blog posts**:
  - "DKP vs Loot Council vs EPGP: Complete Guide (2026)"
  - "How to Use WarcraftLogs for Guild Management"
  - "Setting Up a Fair Loot System for Your WoW Guild"
- **YouTube**: Tutorial videos del tool
- **Wowhead/IcyVeins**: Si aceptan guest posts o tool listings

### Fase 4: Partnerships (mes 3+)
- **WoW streamers**: Ofrecer premium gratis a streamers que lo usen on-stream
- **Top guilds**: Ofrecer lifetime premium a guilds de Cutting Edge
- **WoW content creators**: Review/tutorial partnerships
- **WarcraftLogs**: Listarse como "integrated tool" si tienen directorio

### Metricas Clave
- **Acquisition**: Guilds registrados por semana
- **Activation**: % que completa onboarding
- **Retention**: % activo despues de 30 dias
- **Revenue**: Premium conversions (objetivo: 3-5%)
- **Referral**: Guilds que vienen por recomendacion

---

## Parte 4: Open Source Strategy (opcional pero recomendado)

### Por que open source
- **Trust**: Guilds confian mas en tool open source (pueden ver el codigo)
- **Contributions**: Otros devs pueden contribuir features
- **SEO**: GitHub repos rankean bien
- **Community**: Developers = evangelistas

### Como hacerlo
- Licencia: MIT o AGPL (AGPL si quieres que forks mantengan open source)
- README excelente con screenshots, quick start, architecture
- Contributing guide
- Issue templates
- GitHub Actions CI visible
- Docker Compose para self-hosting facil

### Que mantener privado
- Tu hosted instance y su configuracion
- Discord bot hosting service
- Premium feature flags
- Customer data (obvio)

---

## Archivos a crear

### Onboarding
- `src/pages/Onboarding.jsx` — wizard
- `routes/onboarding.js` — setup endpoints
- `src/components/onboarding/Step1Guild.jsx`
- `src/components/onboarding/Step2Roster.jsx`
- `src/components/onboarding/Step3WCL.jsx`
- `src/components/onboarding/Step4Schedule.jsx`
- `src/components/onboarding/Step5Invite.jsx`

### Landing Page (proyecto separado o paginas en el frontend)
- `src/pages/Landing.jsx` (o proyecto separado)
- Assets: screenshots, feature illustrations

## Verificacion
- [ ] Nuevo usuario puede ir de registro a dashboard operativo en <10 minutos
- [ ] Cada paso del wizard es skippable
- [ ] Invite link funcional
- [ ] Landing page live con pricing y features
- [ ] Al menos 1 post en Reddit/forums
- [ ] Metricas de onboarding tracked (completion rate per step)
