# Subscription Hell Test

A manual stress test for diagnosing video/audio track subscription issues.

## Purpose

This test cycles through many breakout room configurations to help identify:
- Missing subscriptions (never subscribe to the right tracks)
- Failed subscription updates (subscribe but Daily fails silently)
- Browser autoplay policy issues (subscribed but browser blocks playback)
- Remote track state issues (track is "off" or "blocked")

## Test Configuration

**Players:** 4
**Stages:** 8 (5 minutes each, ~40 minutes total)

| Stage | Configuration | Rooms |
|-------|--------------|-------|
| 1 | Full Group | [0,1,2,3] |
| 2 | Dyads A | [0,1], [2,3] |
| 3 | Dyads B | [0,2], [1,3] |
| 4 | Dyads C | [0,3], [1,2] |
| 5 | Triad + Solo | [0,1,2], [3] |
| 6 | Solo + Triad | [0], [1,2,3] |
| 7 | Triad + Solo | [0,1,3], [2] |
| 8 | Triad + Solo | [0,2,3], [1] |

## How to Run

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Create a batch** in the admin panel using `test.config.json`

3. **Open 4 browser windows** (different browsers or incognito windows work best for avoiding cache/session conflicts)

4. **Open browser console (F12)** in each window before joining

5. **Join the batch** with each window

6. **Progress through stages**, at each transition:
   - Verify you can see/hear the right people
   - Check console for `[Subscription]` logs
   - Complete the checklist
   - Note any failures

## What to Look For in Console

### Healthy Output
```
[Subscription] Status check: [
  { dailyId: "abc...", desired: { a: true, v: true },
    actual: { a: true, v: true, aState: "playable", vState: "playable" } }
]
[Subscription] Verification OK - all subscriptions match desired state
```

### Red Flags
- `desired` does not match `actual` - Subscription not being applied
- `aState: "off"` or `vState: "blocked"` - Remote track issue
- `Verification FAILED` - Subscription applied but didn't take effect
- `onPlayFailed` errors - Browser autoplay policy blocking audio

## Documenting Findings

After running the test, note:
1. Which stage transitions had problems?
2. What did the console logs show?
3. Was the pattern consistent or random?
4. Did refreshing the page fix it?

This information will help diagnose whether the issue is with subscription logic, Daily API behavior, or browser policies.
