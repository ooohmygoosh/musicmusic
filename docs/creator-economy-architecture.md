# Creator Economy Architecture

## Goal

Build a music product with three independent but connected systems:

1. Listening subscription
2. Creator ownership and publishing
3. Revenue settlement and anti-abuse control

Recommendation and settlement must stay decoupled:

- Recommendation decides what should play next.
- Settlement decides who gets paid for valid consumption.

## Product Roles

### Listener

- Pays for membership
- Receives continuous recommendation and playback
- Can like, favorite, skip, add to playlist, and tune profile tags

### Creator

- Generates songs manually from portrait/tags
- Owns songs that were manually generated under that account
- Can publish songs into the shared library
- Can receive settlement from valid listening behavior

### Official Account

- Generates fallback songs when the library has no valid hit
- Seeds inventory for cold-start and long-tail tag gaps
- Does not participate in normal creator settlement pool

## Core Ownership Rules

### User-generated songs

- Triggered by explicit user action
- Owner is the current user
- Eligible for publish and revenue

### Official fallback songs

- Triggered automatically when recommendation cannot find a valid match
- Owner is the official system account
- Used for supply continuity only
- Not mixed into user creator revenue accounting

### Reused library songs

- Ownership never changes
- Recommendation only queues the song for the listener
- Playback events contribute to the original owner's revenue metrics

## Data Model Changes

### songs

Add fields:

- `owner_user_id bigint not null`
- `creator_type text not null`
  - `official`
  - `user`
- `generation_source text not null`
  - `portrait_manual`
  - `recommend_fallback`
  - `ops_seed`
- `is_public boolean not null default false`
- `publish_status text not null default 'draft'`
  - `draft`
  - `published`
  - `blocked`
- `revenue_enabled boolean not null default false`
- `visibility_scope text not null default 'private'`
  - `private`
  - `public`
- `official_fallback boolean not null default false`

### generation_jobs

Add fields:

- `requested_by_user_id bigint not null`
- `owner_user_id bigint not null`
- `generation_intent text not null`
  - `manual`
  - `fallback`
  - `ops_seed`
- `should_publish boolean not null default false`

### users

Add fields:

- `role text not null default 'user'`
  - `user`
  - `official`
  - `admin`
- `membership_status text not null default 'free'`
  - `free`
  - `member`
  - `expired`
- `membership_expires_at timestamptz null`
- `wallet_balance numeric(18,6) not null default 0`
- `wallet_frozen numeric(18,6) not null default 0`

### creator_song_stats

Per-song aggregate metrics:

- `song_id bigint primary key`
- `owner_user_id bigint not null`
- `valid_play_count bigint not null default 0`
- `complete_play_count bigint not null default 0`
- `like_count bigint not null default 0`
- `favorite_count bigint not null default 0`
- `share_count bigint not null default 0`
- `revenue_points numeric(18,6) not null default 0`
- `updated_at timestamptz not null`

### creator_revenue_ledger

Immutable accounting ledger:

- `id bigserial primary key`
- `owner_user_id bigint not null`
- `song_id bigint not null`
- `source_user_id bigint not null`
- `event_type text not null`
  - `valid_play`
  - `complete_play`
  - `like`
  - `favorite`
  - `share`
  - `adjustment`
- `points numeric(18,6) not null`
- `amount numeric(18,6) null`
- `settlement_batch_id bigint null`
- `status text not null default 'pending'`
  - `pending`
  - `settled`
  - `rejected`
- `reason text null`
- `created_at timestamptz not null default now()`

### membership_orders

- `id bigserial primary key`
- `user_id bigint not null`
- `plan_code text not null`
- `order_status text not null`
- `amount numeric(18,6) not null`
- `paid_at timestamptz null`
- `expires_at timestamptz null`
- `channel text null`

### risk_events

- `id bigserial primary key`
- `user_id bigint null`
- `song_id bigint null`
- `event_type text not null`
- `risk_level text not null`
- `payload jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

## Recommendation Flow

### With scene tag

1. Scene tag is the primary anchor and must match
2. Core tags are ranked by 2-3 matches first
3. Weak tags only add bonus score
4. If no library match exists, trigger official fallback generation

### Without scene tag

1. Highest-weight active tag becomes anchor
2. Same anchor/core/weak ranking logic applies
3. If no library match exists, trigger official fallback generation

### Queue model

The user queue remains a playback buffer, not the source of truth.

The source of truth is:

1. User profile weights
2. Shared song library
3. Official fallback generation

Recommended runtime target:

- `current_playing`
- `next_prepared`
- standby pool of 3-5 items

## Generation Entry Split

### Manual generation

- Called from portrait page
- `generation_intent = manual`
- `owner_user_id = current user`
- Eligible for publishing and creator revenue

### Automatic fallback generation

- Triggered by recommendation miss
- `generation_intent = fallback`
- `owner_user_id = OFFICIAL_USER_ID`
- Default to public inventory if generation succeeds
- Not counted as user creator work

## Publishing Rules

### Draft

- Visible only to owner
- Playable by owner
- Not discoverable by others
- Not revenue-enabled

### Published

- Can enter shared recommendation pool
- Revenue-enabled if policy allows

### Blocked

- Hidden from recommendation
- Settlement disabled

## Revenue Rules

Do not pay per raw play directly.

Use weighted points:

- `valid_play` (>30s): `+0.4`
- `complete_play`: `+1.0`
- `like`: `+1.5`
- `favorite`: `+2.0`
- `share`: `+2.5`

Repeated same-user replay should decay:

- first play: 100%
- second play: 50%
- third+ play in short window: 0-20%

Monthly settlement:

1. Collect membership revenue pool
2. Deduct platform reserve and operations percentage
3. Distribute creator pool by revenue point ratio

## Membership Rules

### Free

- limited skips
- limited daily generation
- reduced recommendation depth

### Member

- unlimited listening within policy
- higher generation quota
- better queue refill priority
- advanced portrait controls
- creator dashboard and revenue view

## Anti-abuse

Must be implemented before real-money withdrawal:

- self-play detection
- same-device repetitive play inflation
- suspicious like/favorite bursts
- account farm registration
- abnormal completion ratio

Minimum controls:

- device fingerprint
- IP and user-agent clustering
- freeze ledger entries before settlement
- anomaly scoring per user and per song
- manual review queue

## API Plan

### Generation

- `POST /generate`
  - support `intent=manual|fallback`
  - support explicit `owner_user_id`

### Recommendation

- `GET /recommend/next`
  - on miss, optionally trigger fallback generation
  - preserve `needs_generation`
  - add `fallback_triggered`

### Creator

- `GET /creator/songs`
- `POST /creator/songs/:id/publish`
- `POST /creator/songs/:id/unpublish`
- `GET /creator/revenue/summary`
- `GET /creator/revenue/ledger`

### Membership

- `GET /membership`
- `POST /membership/orders`
- `POST /membership/webhook`

### Admin

- creator moderation
- settlement batches
- risk review
- official inventory generation

## Delivery Order

### Phase 1

- add song ownership fields
- add official user concept
- split manual generation vs fallback generation

### Phase 2

- auto fallback generation on recommendation miss
- publish/private song states
- creator song list

### Phase 3

- event ledger for play/like/favorite/share
- creator revenue summary
- basic risk controls

### Phase 4

- membership orders and entitlement checks
- monthly settlement batch
- withdrawal workflow

## Immediate Next Step

Implement Phase 1 first:

1. migration for ownership fields
2. `OFFICIAL_USER_ID` config
3. `/generate` intent split
4. recommendation miss -> official fallback generation
