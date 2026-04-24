# Test Migration: Cypress → Playwright Component Tests

This document tracks the migration of tests from Cypress E2E to Playwright Component Tests.

## Why Migrate?

**Benefits of Component Tests**:
- ⚡ **Faster**: No full backend required, tests run in seconds instead of minutes
- 🎯 **Focused**: Test component rendering/layout in isolation
- 🔧 **Easier to debug**: Direct control over component state
- 📦 **Better organized**: Tests grouped by component and concern

**When to Keep E2E Tests**:
- Multi-step user flows requiring real backend
- Cross-stage interactions
- Server-side logic validation
- Admin operations

---

## Completed Migrations

### ✅ Discussion Layout Tests

**Source**: `cypress/e2e/16_Video_Discussion_Layouts.js` + `cypress/fixtures/mockCDN/test/discussionLayout/` (both deleted)
**Destination**: `playwright/component-tests/video-call/mocked/VideoCall.customLayouts.ct.jsx`
**Status**: ✅ Complete — cypress 16 retired

| Cypress Scenario | Playwright Test | Status |
|------------------|----------------|--------|
| Default Layout | `default layout shows all 3 players` | ✅ |
| TwoByTwo Split | `2x2 grid layout positions tiles correctly` | ✅ |
| PictureInPicture | `picture-in-picture layout with overlapping tiles` | ✅ |
| Telephone game Layout (P0) | `telephone game layout shows asymmetric views` | ✅ |
| Telephone game Layout (P1) | `telephone game layout - Player 1 sees only Player 2` | ✅ |
| Breakout Rooms (P0 & P1) | `breakout rooms - Player 0 sees only roommates` | ✅ |
| Breakout Rooms (P2 alone) | `breakout rooms - Player 2 is alone` | ✅ |
| Hide Self View | `hide self view removes player's own tile` | ✅ |

**Performance Improvement**:
- Cypress E2E: ~2-3 minutes for full test suite
- Playwright CT: ~5 seconds for all 8 tests
- **Speedup: ~30x faster** ⚡

**What Changed**:
- No longer requires real Empirica backend
- No longer requires real Daily.co API calls
- Uses mocked providers (MockEmpiricaProvider + MockDailyProvider)
- Tests layout logic directly without full game flow

---

## Test Count Summary

The mocked CT suite has grown well past what a hand-maintained snapshot
can usefully track. For current counts, see `playwright/component-tests/`
directly or the most recent `npm run test:component` run.

---

## Future Migration Candidates

### High Priority (Good Component Test Candidates)

**Static Layout/Rendering Tests**:
- Video tile states (connecting, disconnected, error states)
- Different player counts (1, 2, 4, 5+ players)
- Responsive layout breakpoints
- Chat component rendering
- Survey/form component rendering

**Why**: These test visual states and don't need real backend interaction.

### Medium Priority

**Interactive Tests** (if we can mock interactions):
- Tray button clicks (mute/unmute, leave call)
- Chat message sending/receiving
- Survey form submission

**Why**: Can test interaction logic with mocked handlers.

### Keep in Cypress

**Full E2E Flows**:
- Complete game flows (intro → stages → exit)
- Multi-player coordination/timing
- Server-side data persistence
- Admin operations
- Video recording functionality

**Why**: These require real backend and multi-step flows.

---

## Migration Checklist Template

When migrating a Cypress test:

1. ✅ Identify what the test is actually verifying (layout? state? interaction?)
2. ✅ Check if it needs real backend (if no → component test candidate)
3. ✅ Create fixture in `shared/fixtures.js` or `shared/layout-fixtures.js`
4. ✅ Write component test using fixture
5. ✅ Verify test passes
6. ✅ Document in this file
7. ✅ Update component README with new test
8. ✅ Remove from Cypress (or mark as deprecated)
9. ✅ Commit changes

---

## Notes

### Testing Philosophy

**Component Tests**: Fast, focused, test rendering and client-side logic
**E2E Tests**: Slow, comprehensive, test full user flows and backend integration

**Ideal balance**:
- 80% component tests (fast feedback loop)
- 20% E2E tests (critical user flows)

### Performance Targets

**Component Tests**:
- Single test: < 1 second
- Full suite: < 10 seconds for 20-30 tests

**E2E Tests**:
- Single test: 1-3 minutes
- Full suite: Keep < 30 minutes total

---

## Migration Progress

- [x] Discussion Layout Tests (8 tests)
- [ ] Video State Tests (TBD)
- [ ] Chat Component Tests (TBD)
- [ ] Survey Component Tests (TBD)

**Total Migrated**: 8 tests
**Estimated Time Saved**: ~2.5 minutes per test run
