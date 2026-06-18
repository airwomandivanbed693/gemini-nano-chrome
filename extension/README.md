# Gemini Nano Chat (extension)

A Chrome extension version of the chat UI in [`web/`](../web). Click the toolbar icon, chat with Gemini Nano. No `npm start`, no Node process, no Chrome DevTools Protocol automation, the popup calls `LanguageModel` directly, the same way any extension does.

## Install it

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**, select this `extension/` folder
4. Click the toolbar icon

## Does this need the flags from the main README?

Not necessarily. Chrome 148+ exposes `LanguageModel` without any flags at all, the API requires an active user gesture (a real click) to call `create()` for the first time on a device that hasn't downloaded the model yet. A click on the popup's Send button satisfies that, so on a fresh Chrome profile, clicking Send the first time should be enough to trigger the download.

That said, this repo's own testing hit a model download that reported `"downloading"` via `chrome://components` but made no measurable progress over several minutes on an unflagged profile, while the same trigger worked immediately on a profile with the two flags already set. Whether that was a rollout/eligibility gate or something else wasn't possible to pin down from outside Chrome's internals. If the popup seems stuck on download after a couple of minutes, falling back to the flags in the [main README](../README.md#enabling-it) is the reliable path:

1. `chrome://flags/#optimization-guide-on-device-model` → **Enabled BypassPerfRequirement**
2. `chrome://flags/#prompt-api-for-gemini-nano` → **Enabled**
3. Relaunch Chrome, then open the extension popup and send a message

## Limitations

- **No persistence.** Closing the popup unloads the page entirely, same as closing a tab. The conversation doesn't survive a close, there's no `chrome.storage` wiring here. ("New chat" only matters within one popup session.)
- **Popup-sized only.** Fixed at 380×560. Chrome extension popups don't support arbitrary window sizing.
- **Same model limits as the rest of this repo.** See [Limits and performance](../README.md#limits-and-performance) in the main README, context window, generation speed, hardware dependence.

## Files

- `manifest.json`: Manifest V3, no special permissions. The old `aiLanguageModelOriginTrial` permission some older guides mention is deprecated and not needed.
- `popup.html` / `popup.js`: the chat UI, adapted from `web/index.html`. The one real difference is that session creation happens lazily, on the first Send click, instead of eagerly on page load, so it always runs inside a real user gesture rather than racing it.
- `icons/`: toolbar icon.
