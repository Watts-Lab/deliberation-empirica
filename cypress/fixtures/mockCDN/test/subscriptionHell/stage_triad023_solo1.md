---
name: test/subscriptionHell/stage_triad023_solo1.md
type: multipleChoice
select: multiple
---

# Triad [0,2,3] + Solo [1]

**Room configuration:**
- Room 1: Positions 0, 2, and 3 (triad)
- Room 2: Position 1 (solo)

**If you are in the triad:** You should see/hear 2 other participants.
**If you are solo (position 1):** You should see only yourself.

Check console for `[Subscription]` logs.

## Verification Checklist

---

- Triad members see/hear each other (2 others)
- Solo participant sees only themselves
- Solo participant shows "only participant" message
- Console shows correct subscription state
