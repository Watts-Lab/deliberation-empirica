# User Gesture & Browser Permission Reference

This document explains how browser permission requirements and user gesture policies affect the Deliberation Lab codebase.

## Quick Reference: What Requires User Gestures?

| API | Requires User Gesture? | How We Handle It |
|-----|----------------------|------------------|
| `getUserMedia()` (first call) | **No** - browser shows its own dialog | Call immediately on mount in `GetPermissions.jsx` |
| `getUserMedia()` (after grant) | **No** - permission cached | Delegated to Daily.co |
| `AudioContext.resume()` | **Yes** (Safari) | "Enable Audio" modal button |
| Daily `join()` | **No** | Async call in useEffect |
| Daily `startCamera()` | **No** (if permissions already granted) | Called after permissions pass |

## Why Most Things Work Without Explicit Gestures

### 1. Browser Permission Prompts Are Special

When you call `getUserMedia()`, the browser itself shows a permission dialog. This dialog:
- Is displayed synchronously from the user's perspective
- Blocks the JavaScript promise until user responds
- The user's click on "Allow" in the browser dialog counts as a gesture
- After "Allow", subsequent `getUserMedia()` calls reuse the cached permission (no dialog, no gesture needed)

```javascript
// In GetPermissions.jsx - works without prior gesture!
navigator.mediaDevices.getUserMedia(constraints)
  .then(stream => /* permission granted */)
  .catch(err => /* permission denied */);
```

### 2. Stage Transitions Are Backend-Coordinated

```
User clicks "Submit" on Stage A
        ↓
player.stage.set("submit", true)  ← User gesture IS in call stack here
        ↓
Empirica backend detects all players submitted
        ↓
Backend advances game to Stage B
        ↓
Stage A unmounts, Stage B mounts  ← New render, NOT in gesture call stack
        ↓
VideoCall joins room in useEffect ← Works because join() doesn't need gesture
```

The key insight: Stage B mounting is triggered by a server state change, not by the original click. But **that's okay** because:
- `join()` doesn't require a user gesture (it's just WebSocket/WebRTC setup)
- Camera/mic access was already granted during intro sequence
- AudioContext is the only thing that might need resuming

### 3. Timer-Based Advances Also Work

When a timer expires and auto-advances the stage:
- Backend decides to advance (no user gesture)
- New stage mounts (no gesture context)
- Daily `join()` works (doesn't need gesture)
- Camera/mic work (permission cached)
- **Only AudioContext might be suspended** (especially Safari)

This is why we added `useAudioContextMonitor` - to detect and prompt for the gesture when needed.

## Where User Gestures ARE Required

### AudioContext.resume() on Safari

Safari suspends AudioContext by default due to autoplay policies. Resuming requires a gesture:

```javascript
// ❌ FAILS - not in gesture context
setInterval(() => {
  audioContext.resume(); // Silent failure
}, 5000);

// ✅ WORKS - click handler provides gesture
button.onclick = () => {
  audioContext.resume(); // Success!
};
```

**Our solution**: `useAudioContextMonitor.js` detects suspended state and shows modal with button.

### Fullscreen API (If Used)

```javascript
// ❌ FAILS
useEffect(() => {
  document.documentElement.requestFullscreen(); // Error!
}, []);

// ✅ WORKS
button.onclick = () => {
  document.documentElement.requestFullscreen();
};
```

### Clipboard API (If Used)

```javascript
// ❌ FAILS (in most browsers)
navigator.clipboard.writeText("copied"); // Error!

// ✅ WORKS
button.onclick = () => {
  navigator.clipboard.writeText("copied");
};
```

## The Permission Acquisition Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTRO SEQUENCE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Consent                                                     │
│         ↓                                                       │
│  2. AttentionCheck                                              │
│         ↓                                                       │
│  3. VideoEquipmentCheck                                         │
│      ├─ GetPermissions (camera + mic)                           │
│      │      ↓ calls getUserMedia() immediately                  │
│      │      ↓ browser shows permission dialog                   │
│      │      ↓ user clicks Allow (GESTURE for future use)        │
│      │      ↓ permission granted & cached                       │
│      └─ CameraCheck (uses granted permission)                   │
│         ↓                                                       │
│  4. AudioEquipmentCheck                                         │
│      ├─ GetPermissions (audio only - usually already granted)   │
│      ├─ HeadphonesCheck                                         │
│      ├─ MicCheck                                                │
│      └─ LoopbackCheck (creates fresh AudioContext)              │
│         ↓                                                       │
│  5. EnterNickname                                               │
│         ↓                                                       │
├─────────────────────────────────────────────────────────────────┤
│                          GAME STAGES                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  VideoCall component mounts                                     │
│      ├─ Uses cached camera/mic permissions (no gesture needed)  │
│      ├─ Joins Daily room (no gesture needed)                    │
│      └─ Creates AudioContext for monitoring                     │
│           ↓                                                     │
│         If suspended (Safari): shows "Enable Audio" modal       │
│         User clicks button (GESTURE) → AudioContext.resume()    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Key Files

| File | Permission/Gesture Role |
|------|------------------------|
| `intro-exit/setup/GetPermissions.jsx` | Acquires camera/mic permissions via `getUserMedia()` |
| `intro-exit/setup/LoopbackCheck.jsx` | Creates fresh AudioContext for loopback test (destroyed after) |
| `intro-exit/setup/CameraCheck.jsx` | Uses Daily's `startCamera()` with granted permission |
| `intro-exit/setup/MicCheck.jsx` | Uses Daily's device enumeration with granted permission |
| `call/VideoCall.jsx` | Joins Daily room; monitors AudioContext; shows "Enable Audio" if needed |
| `call/useAudioContextMonitor.js` | Detects suspended AudioContext; provides gesture-based resume |

## Why Safari Fails More Often

Safari is stricter about autoplay policies:

1. **Chrome/Firefox**: Often allow AudioContext after any user interaction with the page
2. **Safari**: Requires interaction specifically with audio-related content, and may re-suspend after tab switches

Safari-specific issues we've seen:
- AudioContext suspended on initial page load
- AudioContext re-suspended after switching tabs
- AudioContext suspended when joining call from timer-based stage advance

## Potential Improvements

### 1. Global Click Listener for AudioContext Resume

```javascript
// In App.jsx or VideoCall.jsx
useEffect(() => {
  const handleGlobalClick = () => {
    if (audioContextRef.current?.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };
  document.addEventListener('click', handleGlobalClick, { capture: true });
  return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
}, []);
```

**Pros**: Any click anywhere resumes AudioContext
**Cons**: Slightly wasteful (calls resume on every click)

### 2. Persistent AudioContext from Equipment Check

Create AudioContext during LoopbackCheck and keep it alive:

```javascript
// Global or context-based AudioContext
const audioContextRef = useRef(null);

// In LoopbackCheck or earlier
if (!audioContextRef.current) {
  audioContextRef.current = new AudioContext();
}

// In VideoCall - reuse the same context
// Don't create a new one
```

**Pros**:
- AudioContext created during user interaction (loopback test button click)
- User gesture from loopback test "blesses" the context
- Single context used throughout session

**Cons**:
- Requires prop drilling or React context for sharing
- AudioContext might still suspend on tab switch
- Need to handle context closure if user abandons session

### 3. Force Gesture Before Critical Stages

Add an interstitial "Click to Continue" before stages that need audio:

```javascript
// Before game stage with video call
function ClickToContinue({ onContinue }) {
  return (
    <button onClick={() => {
      // Resume any suspended audio contexts here
      resumeAudioContext();
      onContinue();
    }}>
      Click to start discussion
    </button>
  );
}
```

**Pros**: Guaranteed gesture before audio-critical content
**Cons**: Extra click for users; annoying if not needed

## Debugging Tips

### Check AudioContext State

```javascript
console.log(audioContext.state); // "suspended" | "running" | "closed"
```

### Monitor Permission State

```javascript
const result = await navigator.permissions.query({ name: "camera" });
console.log(result.state); // "granted" | "denied" | "prompt"
```

### Force Suspend (Testing)

In Safari DevTools:
1. Open Privacy tab
2. Toggle camera/microphone permissions
3. Observe how app handles re-prompting

Or close/reopen Safari to reset AudioContext state.

## Related Issues

- #1159 - Safari AudioContext suspended diagnosis
- #1155 - Cross-participant A/V diagnostics
- #1157 - Diagnostics requests and reporting
