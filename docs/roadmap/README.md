# DKP Manager — Roadmap

Generated: 2026-02-14

## Overview

12 briefs organizados en 3 fases. Cada brief es autocontenido y puede abordarse en un chat independiente.

---

## Fase 1: Hardening (pre-producto) — ~2 semanas

| # | Brief | Prioridad | Esfuerzo | Dependencias |
|---|-------|-----------|----------|--------------|
| 01 | [Security Hardening](01-security-hardening.md) | CRITICA | 1-2 dias | Ninguna |
| 02 | [Performance & N+1 Fixes](02-performance-n1-fixes.md) | ALTA | 1-2 dias | Ninguna |
| 03 | [Bug Fixes](03-bug-fixes.md) | ALTA | 0.5-1 dia | Ninguna |
| 04 | [Test Coverage](04-test-coverage.md) | ALTA | 3-5 dias | Despues de 01-03 |
| 05 | [Operations & Production](05-operations-production.md) | ALTA | 1-2 dias | Ninguna |

**Paralelismo**: 01, 02, 03 y 05 se pueden hacer en paralelo. 04 va despues (testea los fixes).

---

## Fase 2: Product-Ready — ~3 semanas

| # | Brief | Prioridad | Esfuerzo | Dependencias |
|---|-------|-----------|----------|--------------|
| 06 | [API Standardization](06-api-standardization.md) | MEDIA | 2-3 dias | Fase 1 |
| 07 | [Frontend UX](07-frontend-ux.md) | MEDIA | 3-5 dias | Ninguna |
| 08 | [Discord Bot](08-discord-bot.md) | S-TIER | 1-2 sem | 06 (API consistente) |
| 11 | [Mobile PWA](11-mobile-pwa.md) | MEDIA | 3-5 dias | 07 (responsive) |

**Paralelismo**: 06 y 07 en paralelo. 08 y 11 despues.

---

## Fase 3: Market Expansion — ~4 semanas

| # | Brief | Prioridad | Esfuerzo | Dependencias |
|---|-------|-----------|----------|--------------|
| 09 | [Multi-Tenancy](09-multi-tenancy.md) | ALTA | 2-3 sem | Fase 1 + 06 |
| 10 | [Loot Council & EPGP](10-loot-systems.md) | MEDIA-ALTA | 2-3 sem | 09 (multi-tenant) |
| 12 | [Onboarding & GTM](12-onboarding-gtm.md) | ALTA | 1-2 sem | 09 |

**Paralelismo**: 10 y 12 pueden hacerse en paralelo despues de 09.

---

## Quick Reference: Estado Actual

| Metrica | Valor |
|---------|-------|
| Endpoints | 106 |
| Tests | 176 (43% coverage) |
| Route modules | 17 |
| Frontend components | 27 |
| Languages | ES/EN |
| Competidores que ofrecen todo esto junto | 0 |

---

## Orden sugerido para chats

**Si quieres producto rapido:**
01 → 03 → 02 → 05 → 06 → 08 (Discord Bot) → 09 → 12

**Si quieres solidez primero:**
01 → 02 → 03 → 05 → 04 → 06 → 07 → 11 → 08 → 09 → 10 → 12

**Si quieres impacto inmediato para tu guild:**
03 (bug fixes) → 02 (performance) → 08 (Discord bot)
