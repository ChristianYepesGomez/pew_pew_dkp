# API Endpoints

106+ endpoints across 17+ route modules. All prefixed with `/api/` unless noted.

> **API Version**: v1 (implicit). Current routes at `/api/*` are v1. Future breaking changes will use `/api/v2/`.

## Response Format

All endpoints return a standardized JSON envelope:

```jsonc
// Success (2xx)
{ "success": true, "data": { ... }, "message": "optional" }

// Error (4xx/5xx)
{ "success": false, "error": "Human-readable message", "code": "ERROR_CODE", "details": { ... } }

// Paginated (list endpoints)
{ "success": true, "data": [ ... ], "pagination": { "limit": 50, "offset": 0, "total": 123, "hasMore": true } }
```

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Missing or invalid input |
| `NOT_FOUND` | Resource not found |
| `ALREADY_EXISTS` | Duplicate resource |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `TOKEN_EXPIRED` | JWT access token expired |
| `INVALID_TOKEN` | JWT token is invalid |
| `INSUFFICIENT_DKP` | Not enough DKP for operation |
| `AUCTION_CLOSED` | Auction is not active |
| `BID_TOO_LOW` | Bid below minimum |
| `SELF_BID` | Cannot bid on own auction |
| `SIGNUP_LOCKED` | Calendar signup deadline passed |
| `RATE_LIMITED` | Too many requests |
| `EXTERNAL_API_ERROR` | Third-party API failure |
| `INTERNAL_ERROR` | Server error |

## Pagination

Paginated endpoints accept `?limit=N&offset=N` query parameters:
- `limit`: Items per page (default: 50, max: 100; members: default 200, max 500)
- `offset`: Number of items to skip (default: 0)

Paginated endpoints: `GET /members`, `GET /auctions/history`, `GET /dkp/history/:userId`, `GET /warcraftlogs/history`

## Read Permissions

- `GET /dkp/history/:userId`: Raiders can only view their own history. Officers/admins can view any user.
- Other GET endpoints with `:userId` (armory, BIS): visible to all authenticated guild members.

---

## Auth (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/login` | Login with credentials |
| POST | `/register` | Register new user |
| POST | `/forgot-password` | Request password reset |
| POST | `/reset-password` | Complete password reset |
| POST | `/change-password` | Change own password |
| POST | `/admin-reset-password` | Admin resets user password |
| GET | `/me` | Get current user |
| PUT | `/profile` | Update profile |

## Blizzard OAuth (`/api/auth/blizzard`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/url` | Get OAuth redirect URL |
| GET | `/callback` | OAuth callback |

## Armory (`/api/armory`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/:userId/loot` | User loot history |
| GET | `/equipment/:realm/:character` | Character equipment |
| GET | `/media/:realm/:character` | Character media |
| GET | `/:userId/profile` | User armory profile |

## Members (`/api/members`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List all members |
| PUT | `/:id/role` | Update member role |
| PUT | `/:id/vault` | Update vault status |
| DELETE | `/:id` | Remove member |
| POST | `/` | Add member |

## Characters (`/api/characters`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List user characters |
| POST | `/` | Add character |
| PUT | `/:id` | Update character |
| DELETE | `/:id` | Delete character |
| PUT | `/:id/primary` | Set primary character |

## DKP (`/api/dkp`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/adjust` | Adjust single user DKP |
| POST | `/bulk-adjust` | Bulk DKP adjustment |
| POST | `/decay` | Apply DKP decay |
| GET | `/history/:userId` | User DKP history |

## Calendar (`/api/calendar`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/raid-days` | Get raid schedule |
| PUT | `/raid-days` | Update raid schedule |
| GET | `/dates` | Get calendar dates |
| GET | `/my-signups` | Current user signups |
| POST | `/signup` | Sign up for raid |
| GET | `/summary/:date` | Day summary |
| GET | `/overview` | Calendar overview |
| GET | `/history` | Calendar history |
| GET | `/dates-with-logs` | Dates with WCL logs |

## Auctions (`/api/auctions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/active` | List active auctions |
| POST | `/` | Create auction |
| POST | `/:auctionId/bid` | Place bid |
| POST | `/:auctionId/end` | End auction |
| POST | `/:auctionId/cancel` | Cancel auction |
| POST | `/cancel-all` | Cancel all auctions |
| GET | `/history` | Auction history |
| GET | `/:auctionId/rolls` | Auction rolls |
| GET | `/:auctionId/bids` | Auction bids |

## WarcraftLogs (`/api/warcraftlogs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/config` | Get WCL config |
| PUT | `/config` | Update WCL config |
| POST | `/preview` | Preview log import |
| POST | `/confirm` | Confirm log import |
| GET | `/history` | Import history |
| GET | `/report/:code/transactions` | Report transactions |
| POST | `/revert/:reportCode` | Revert import |
| GET | `/guild-reports` | Guild reports |
| POST | `/import-boss-stats` | Import boss stats |
| GET | `/pending-reports` | Pending reports |
| POST | `/auto-process/:code` | Auto-process report |

## Analytics (`/api/analytics`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/attendance` | Attendance stats |
| GET | `/dkp-trends` | DKP trends |
| GET | `/economy` | Economy stats |
| GET | `/auctions` | Auction analytics |
| GET | `/progression` | Raid progression |
| GET | `/superlatives` | Player superlatives |
| GET | `/my-performance` | My performance |
| GET | `/my-performance-detail` | My detailed performance |
| GET | `/guild-insights` | Guild insights |

## BIS Lists (`/api/bis`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/my` | My BIS list |
| GET | `/user/:userId` | User BIS list |
| GET | `/item/:itemId` | Item BIS info |
| POST | `/` | Add BIS item |
| PUT | `/reorder` | Reorder BIS list |
| PUT | `/:id` | Update BIS item |
| DELETE | `/:id` | Delete BIS item |

## Raids (`/api/raids`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create raid |
| POST | `/:raidId/attendance` | Record attendance |

## Import (`/api/import`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/roster` | Import roster |

## Bosses (`/api/bosses`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List bosses |
| GET | `/debug/stats` | Debug boss stats |
| GET | `/:bossId` | Get boss details |
| POST | `/sync` | Sync boss data |
| PUT | `/zones/:zoneId/legacy` | Mark zone as legacy |

## Buffs (`/api/buffs`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stream` | SSE buff stream |
| GET | `/active` | Active buffs |

## Items (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/raid-items` | List raid items |
| GET | `/raid-items/search` | Search items |
| GET | `/raid-items/:raidName` | Items by raid |
| GET | `/raids-list` | List raids |
| GET | `/raid-items/status` | Item cache status |
| POST | `/raid-items/refresh` | Refresh item cache |
| GET | `/dungeon-items` | Dungeon items |
| GET | `/all-items` | All items |
| GET | `/item-popularity` | Item popularity |

## Health (`/`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
