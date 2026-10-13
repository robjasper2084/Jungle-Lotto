# Room chat and voice refresh — 13 October 2026

This release is based on the published `f387026bec10b97d7b2f881ba5d996d1b69aa60b` game. The other chat completed and verified its FPS8 changes during this work; those files are integrated to keep the published client compatible with the already-updated multiplayer server. See `fps-upgrade-20261013.md` for the feature and asset-quality limits.

## Changes

- Swoop Detroit, Elmwood Explorer and Static Royale use one collapsible Chat / Voice panel in the lobby and during a match. Lobby placement follows the player roster. Starting a match collapses the panel; closing it restores the gameplay view.
- Quick messages, unread counts, one-action microphone activation, speaker mute, push-to-talk, channel selection, volume and individual player mute are grouped together. Microphone capture remains opt-in, and leaving voice or a room stops capture.
- Opening the panel releases gameplay input and blocks movement/shooting while entering messages. Escape or Close collapses it. Voice continues across lobby-to-match transitions.
- Royale chat is validated and relayed by the authoritative server, including sender identity, 160-character limits and rate limiting. Relay forwarding supports chat without changing the lease or access permissions.
- Immutable collision downloads use a verified browser cache, with recovery from corrupt entries or denied storage. This reduces repeat downloads, not the scene's first-load geometry or memory requirements.
- Living birds now use the mesh decoder and skeleton-safe cloning required by the exported models.

## Verification

- Isolated core, server and all three game entries built successfully.
- Fifteen combined FPS, cache, fixture and voice-protocol tests passed after integration.
- Three automated Royale clients verified lobby chat, sender identity, room isolation, invalid-message rejection and rate limiting; see `love-tag-server/evidence/royale-chat-20261013.json`.
- Two browser players exchanged Swoop messages and reached a connected voice state in listening mode. Lobby-to-game collapse and retained voice connection were checked.
- Elmwood's lobby placement and voice controls, and Royale's authoritative lobby chat, were checked in the browser.

## Remaining external checks

Audible speech between real people on different networks and the 2020 iPad Pro retest remain pending. Browser desktop checks do not establish mobile frame times or audio quality. The existing private test relay remains temporary and depends on this computer; this release does not extend its access or provide permanent hosting.
