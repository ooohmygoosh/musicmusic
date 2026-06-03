# Vibo Music Mobile Iteration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the current Vibo Music prototype into a locally testable Expo/React Native mobile app with a durable feed-first interaction model, clearer visual direction, modular frontend state/API boundaries, and Android emulator verification.

**Architecture:** Keep Expo/React Native for mobile and Fastify/PostgreSQL for the real backend. Use a local Node mock API while Postgres/Docker is unavailable so the app can be tested quickly in VSCode and Android Emulator without depending on production services.

**Tech Stack:** Expo SDK 50, React Native 0.73, expo-av, Skia, Fastify, PostgreSQL, Node mock API, ADB/uiautomator.

---

## Design Direction

**Aesthetic name:** Nocturnal Signal Lab.

**DFII score:** 12/15.

**Rationale:** The app is an AI music flow, not a standard media library. The memorable anchor is a dark signal-field interface: blurred generated color fields, tag-weight galaxy blocks, and a creator earnings panel that feels like an audio operations console rather than a generic streaming clone.

**Mobile checkpoint:**
- Platform: iOS and Android.
- Framework: Expo/React Native.
- Navigation: 5 bottom tabs for song flow, favorites, portrait, creator revenue, settings.
- Offline/local mode: local mock API supports feed, tags, play events, generation jobs, playlists, and creator dashboard.
- Primary mobile rules: 48dp touch targets, feed-first playback in thumb zone, no long lists with `ScrollView` if item counts can grow.

## File Map

- `app/App.js`: Current large container. Keep working behavior, but continue moving API/state/UI pieces out of this file.
- `app/src/services/apiClient.js`: API boundary for all backend calls.
- `app/src/services/feedTransform.js`: Feed/queue normalization and queue key generation.
- `app/src/hooks/useCreatorDashboard.js`: Creator dashboard server-state hook.
- `app/src/components/CreatorDashboard.js`: Creator center UI.
- `app/src/components/ScreenTitle.js`: Shared section title.
- `app/dev/mock-api.js`: Local backend used for fast iteration.
- `backend/src/services/feedService.js`: Backend feed ordering and queue replenishment logic.
- `backend/src/services/playEventService.js`: Play-event idempotency and effective play logic.
- `backend/src/services/royaltyService.js`: Simulated royalty ledger calculation.
- `backend/test/*.test.js`: Service tests for queue, play events, royalties.

## Task 1: Branch And Baseline

**Files:**
- Inspect: `.git/config`
- Inspect: working tree status

- [x] **Step 1: Verify the requested branch source**

Run:

```powershell
git fetch https://github.com/ooohmygoosh/musicmusic.git codex/githubv3
```

Expected if network works: remote branch is fetched and can be checked out or compared.

Observed on this machine: GitHub port 443 connection failed twice, including with cleared git proxy. Continue from the current local worktree, but report this as a baseline risk.

- [x] **Step 2: Protect existing changes**

Run:

```powershell
git status --short --branch
```

Expected: Identify untracked artifacts and implementation files before editing. Do not revert unrelated user changes.

## Task 2: Local Backend For Fast Iteration

**Files:**
- Create/modify: `app/dev/mock-api.js`
- Verify: `app/artifacts/mock-api.log`

- [x] **Step 1: Implement a dependency-free mock API**

The mock must support:

```text
GET /health
GET /tags
POST /users
GET /user-tags
POST /init-tags
POST /user-tags
POST /tags/custom
POST /user-tags/remove
POST /user-tags/weight
GET /feed
POST /feed/next
GET /songs
GET /favorites
POST /feedback
POST /play-events
GET /playlists
POST /playlists
GET /playlists/:id/songs
POST /playlists/:id/add
POST /playlists/:id/remove
POST /generate
POST /generation-jobs
GET /generation-jobs/:id
GET /creator/dashboard
```

- [x] **Step 2: Start the mock API in the background**

Run from `app`:

```powershell
Start-Process -FilePath node -ArgumentList @('dev\mock-api.js') -WorkingDirectory '<repo>\musicmusic-main\app' -RedirectStandardOutput '<repo>\musicmusic-main\app\artifacts\mock-api.log' -RedirectStandardError '<repo>\musicmusic-main\app\artifacts\mock-api.err.log' -WindowStyle Hidden
```

Expected: `http://127.0.0.1:8080/health` returns `{"ok":true,"mode":"mock"}`.

## Task 3: Frontend State And API Boundaries

**Files:**
- Modify: `app/src/services/apiClient.js`
- Modify: `app/src/services/feedTransform.js`
- Modify: `app/src/hooks/useCreatorDashboard.js`
- Modify: `app/src/components/CreatorDashboard.js`
- Modify: `app/App.js`

- [x] **Step 1: Move API calls behind named service functions**

Example pattern:

```js
export function loadFeed(userId) {
  return apiJson(`/feed?user_id=${encodeURIComponent(userId)}`);
}
```

- [x] **Step 2: Normalize feed items without sorting by song ID**

Example pattern:

```js
export function songFromFeedItem(item) {
  if (!item?.song) return null;
  return {
    ...item.song,
    queue_id: item.queue_id,
    feed_position: item.position,
    reason: item.reason,
    is_generating_next: item.is_generating_next
  };
}
```

- [x] **Step 3: Fix visible creator dashboard text encoding**

Replace mojibake separators with readable characters:

```js
`¥${Number(value || 0).toFixed(2)}`
`Effective ${effective} · Plays ${plays} · ¥${revenue}`
```

- [ ] **Step 4: Continue splitting `App.js` after current verification**

Next components to extract:

```text
src/components/TabBar.js
src/screens/PlayerScreen.js
src/screens/FavoritesScreen.js
src/screens/ProfileScreen.js
src/screens/SettingsScreen.js
```

Do this only after preserving the current verified behavior with tests or emulator screenshots.

## Task 4: Backend Service Tests

**Files:**
- Verify: `backend/test/feedService.test.js`
- Verify: `backend/test/playEventService.test.js`
- Verify: `backend/test/royaltyService.test.js`
- Verify: `backend/src/services/*.js`

- [x] **Step 1: Add feed ordering tests**

Expected behavior: queue order is based on queue position/id, not `song.id`.

- [x] **Step 2: Add play event idempotency tests**

Expected behavior: duplicate `client_event_id` does not double-count effective plays.

- [x] **Step 3: Add royalty calculation tests**

Expected behavior: monthly pool distributes by effective plays and ownership share.

## Task 5: Validation

**Files:**
- Verify: `app/package.json`
- Verify: `backend/package.json`

- [x] **Step 1: Run frontend export/build check**

Run from `app`:

```powershell
npx.cmd expo export --platform android --output-dir dist-check
```

Expected: exit code 0.

- [x] **Step 2: Run backend tests if a test runner is available**

Run from `backend`:

```powershell
npm.cmd test
```

Expected: exit code 0. The backend now exposes `npm test` for the service tests.

- [ ] **Step 3: Run security audit**

Run from `app` and `backend`:

```powershell
npm.cmd audit --audit-level=high
```

Expected: report high vulnerabilities or exit 0.

Observed before backend lockfile creation: app audit failed because the configured npm mirror does not implement the audit endpoint; backend audit failed because no lockfile existed. Re-run after lockfile generation or after switching npm registry to one with audit support.

## Task 6: Android Emulator Functional Verification

**Files:**
- Write: `app/artifacts/view_local_*.xml`
- Write: `app/artifacts/screen_local_*.png`

- [x] **Step 1: Verify emulator calibration**

Run:

```powershell
adb devices -l
adb shell wm size
```

Expected: one running emulator and stable resolution.

- [x] **Step 2: Verify login and feed**

Expected UI evidence:

```text
Login & restore
Songs
Glass Orbit
Play
Next
Queue
```

- [x] **Step 3: Verify play-event chain**

Expected mock API log evidence:

```text
POST /feedback
POST /feed/next
POST /play-events
```

- [x] **Step 4: Verify creator dashboard**

Expected UI evidence:

```text
Vibo creator center
Total plays
Effective plays
Estimated
My generated songs
```

- [x] **Step 5: Verify Settings API test**

Expected UI evidence:

```text
API: http://10.0.2.2:8080 | items: 5
```

## Completion Criteria

- The app can be started with a local mock backend and tested without the production API.
- The Android emulator proves login, feed rendering, next-song event reporting, creator dashboard, and settings API test.
- The UI direction and mobile interaction constraints are captured in this plan.
- Validation commands are run fresh before any completion claim.
- The inability to fetch `codex/githubv3` is either resolved or explicitly reported as a remaining baseline risk.
