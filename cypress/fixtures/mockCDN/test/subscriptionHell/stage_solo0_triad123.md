---
name: test/subscriptionHell/stage_solo0_triad123.md
type: multipleChoice
select: multiple
---

# Solo [0] + Triad [1,2,3]

**Room configuration:**
- Room 1: Position 0 (solo)
- Room 2: Positions 1, 2, and 3 (triad)

**If you are solo (position 0):** You should see only yourself.
**If you are in the triad:** You should see/hear 2 other participants.

Check console for `[Subscription]` logs.

## Verification Checklist

---

- Solo participant sees only themselves
- Triad members see/hear each other (2 others)
- Solo participant shows "only participant" message
- Console shows correct subscription state
