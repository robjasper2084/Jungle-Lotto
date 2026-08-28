# Optional analytics — Store conversion v2

store/state/analytics.ts exports a typed, no-op adapter. No vendor, advertising tracker, third-party request, or consent grant is configured. Calling an event does not transmit anything by default.

To add a service later, separately approve the vendor, privacy notice, retention, consent/revocation UI, and implementation. Both a sender and explicit consent are needed. Sender exceptions never interrupt shopping.

| Event | Meaning |
|---|---|
| view_home | Homepage rendered |
| view_item | Product detail rendered |
| view_collection | Collection rendered |
| search | Catalog search updated; only result count |
| apply_filter | Catalog filter updated; only result count |
| select_item | Product link selected |
| choose_options | Product options dialog opened |
| save_to_loadout | Valid interest selection saved |
| remove_from_loadout | Saved selection removed |
| launch_alert_open | Alert dialog opened |
| launch_alert_submit | Configured service explicitly acknowledged the submission |
| launch_alert_error | Validation, missing service, or request failure |
| watch_campaign | Visitor requested the commercial |
| launch_game | Visitor requested game launch |
| game_match_complete | Validated game-frame completion message |
| product_to_game | Product-to-game link selected |
| game_to_collection | Game result collection link selected |

Compatibility event names remain typed for prior integrations: page_view, select_variant, add_to_cart, remove_from_cart, view_cart, begin_checkout, play_game, character_selected, match_completed, digital_reward_unlocked, newsletter_signup, watch_transmission. A type entry alone does not imply an event is emitted.

## Payload restrictions

Only handle, collection, variant, quantity, mode, character, result, duration, count, and filter keys are allowed. Values must be finite numbers, booleans, or short identifier-like strings. No email, name, full search query, complete URL/query string, postal address, customer ID, payment information, or source form body is sent.

Subscription POSTs are a separate explicitly requested service action, not analytics. Their consent version and selected item preferences are documented in COMMERCE_SETUP.md. Game messages are validated for exact origin, frame source, schema, and approved character before analytics or a cosmetic local badge. Nothing awards money, credit, inventory, or checkout discounts.
