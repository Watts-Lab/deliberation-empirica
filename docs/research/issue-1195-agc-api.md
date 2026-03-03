# Research: Correct Daily.co API for Disabling AutoGainControl Mid-Call

_Investigation for [Issue #1195](https://github.com/Watts-Lab/deliberation-empirica/issues/1195)_

---

## Summary

**The correct API is `updateInputSettings()` with constraints nested under `audio.settings`.**

Neither approach described in the issue was quite right. Here's the full picture:

---

## API Findings

### What the TypeScript types actually say

From [`daily-co/daily-js index.d.ts`](https://github.com/daily-co/daily-js/blob/daily-js-releases/index.d.ts):

```typescript
// setInputDevicesAsync — audioSource is MediaStreamTrack, NOT constraints
setInputDevicesAsync(devices: {
  audioDeviceId?: string | false | null;
  audioSource?: MediaStreamTrack | false;   // <-- track only, not constraints
  videoDeviceId?: string | false | null;
  videoSource?: MediaStreamTrack | false;
}): Promise<DailyDeviceInfos>

// updateInputSettings — audio.settings accepts MediaTrackConstraints
interface DailyInputAudioSettings {
  processor?: DailyInputAudioProcessorSettings;
  settings?: MediaTrackConstraints | DailyCustomTrackSettings;  // <-- constraints go HERE
}

updateInputSettings(
  inputSettings: DailyInputSettings
): Promise<{ inputSettings: DailyInputSettings }>
```

### Attempt 1: `setInputDevicesAsync({ audioSource: constraints })` — **confirmed broken**

`audioSource` is typed as `MediaStreamTrack | false`. Passing a plain constraints object is
a type error; Daily silently ignores it and warns `"Received unexpected audioDeviceId"`.

### Attempt 2: `updateInputSettings({ audio: constraints })` — **wrong nesting**

The error `inputSettings must be of the form: { audio?: { processor: ... } }` suggests that
constraints were passed directly as `audio`, not under `audio.settings`. The correct nesting is:

```js
// WRONG — as attempted in the issue
await callObject.updateInputSettings({
  audio: {
    autoGainControl: false,       // <-- directly on audio, wrong
    echoCancellation: true,
    noiseSuppression: true,
  },
});

// CORRECT
await callObject.updateInputSettings({
  audio: {
    settings: {                   // <-- must be nested under settings
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
});
```

Support for `MediaTrackConstraints` in `audio.settings` was added in Daily's
[December 2023 changelog](https://docs.daily.co/changelog/053-2023-12-06). We're on
`@daily-co/daily-js ^0.87.0` (Aug 2025), so this is available.

---

## Answers to Open Questions

### Q1: Does Daily "take back" control of the track and revert to default constraints?

**No**, for the `updateInputSettings` approach. From the docs:

> If you want to change just the `deviceId` without affecting other constraints,
> `setInputDevicesAsync()` does just that — it is a helper method that wraps updating
> the input setting and **merges the `deviceId` with existing constraints**.

This means `alignMicrophone()` (which calls `setInputDevicesAsync({ audioDeviceId })`)
**will preserve** the AGC constraint set via `updateInputSettings`. The constraints are only
reset if a `getUserMedia()` error occurs.

_Caveat_: if `autoGainControl: false` causes a constraint error in some browser, Daily resets
settings to defaults and emits a `nonfatal-error`. We should log the `nonfatal-error` event.

### Q2: Do we need to clean up a custom track?

**Not applicable** — we do not need the custom-track approach. `updateInputSettings` with
`settings: MediaTrackConstraints` keeps Daily in full control of the track lifecycle. No
manual cleanup needed.

### Q3: Is there a supported Daily pattern for this use case?

Yes. From Daily docs (confirmed via TypeScript types):

```js
await callObject.updateInputSettings({
  audio: {
    settings: {
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
});
```

Daily also supports specifying `inputSettings` at call-object creation or `join()` time
(added March 2023), so this could be set before joining rather than after.

### Q4: Would it be cleaner to pass constraints at call-object creation time?

Possibly. We could pass `inputSettings` to `join()`:

```js
await callObject.join({
  url: roomUrl,
  inputSettings: {
    audio: {
      settings: {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      },
    },
  },
});
```

This avoids the post-join async call and ensures constraints are set before any
audio processing begins. **This is the cleaner approach.**

---

## Important Caveats

### Daily explicitly warns against overriding constraints

> For most use cases, Daily does **not** recommend overriding constraints. Track constraints are
> implemented inconsistently across browsers. Daily has sorted through these, using reasonable
> defaults to accommodate browser-specific issues.

Chrome in particular has quirks: in some versions, `autoGainControl` cannot be disabled
independently of `echoCancellation`. Testing across Chrome, Firefox, and Safari is essential.

### Constraint verification in testing

After applying, check that the constraint actually took effect:

```js
const track = callObject.participants().local.tracks.audio.persistentTrack;
const settings = track?.getSettings();
console.log('autoGainControl:', settings?.autoGainControl);  // should be false
```

### Mute/unmute cycles

Normal `callObject.setLocalAudio(false/true)` mute/unmute cycles **do not discard the track**
(unless `forceDiscardTrack: true` is passed). Constraints set via `updateInputSettings`
persist through normal mute/unmute. Constraints are only reset if a `getUserMedia()` error
occurs during re-acquisition.

However: if `FixAV.jsx` re-acquires the microphone via `setInputDevicesAsync({ audioDeviceId })`,
the constraints _should_ persist (merged behavior), but this should be tested explicitly.

---

## Recommended Implementation

Replace the current post-join hack in `VideoCall.jsx:287-301`:

```js
// Current (broken — setInputDevicesAsync ignores constraints objects):
await callObject.setInputDevicesAsync({
  audioSource: { autoGainControl: false, echoCancellation: true, noiseSuppression: true },
});

// Fix option A — post-join updateInputSettings:
await callObject.updateInputSettings({
  audio: {
    settings: {
      autoGainControl: false,
      echoCancellation: true,
      noiseSuppression: true,
    },
  },
});

// Fix option B (cleaner) — pass inputSettings directly to join():
await callObject.join({
  url: roomUrl,
  userData: position != null ? { position } : undefined,
  inputSettings: {
    audio: {
      settings: {
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      },
    },
  },
});
```

Option B is preferred: it's cleaner, removes the post-join async call, and ensures
constraints are set before any audio processing begins.

---

## References

- [Daily `updateInputSettings()` docs](https://docs.daily.co/reference/daily-js/instance-methods/update-input-settings)
- [Daily `setInputDevicesAsync()` docs](https://docs.daily.co/reference/daily-js/instance-methods/set-input-devices-async)
- [daily-js TypeScript types (`index.d.ts`)](https://github.com/daily-co/daily-js/blob/daily-js-releases/index.d.ts)
- [Daily changelog #053 — MediaTrackConstraints support added](https://docs.daily.co/changelog/053-2023-12-06)
- [MDN: `MediaTrackConstraints.autoGainControl`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/autoGainControl)
- [getUserMedia constraints blog post (addpipe.com)](https://blog.addpipe.com/audio-constraints-getusermedia/)
