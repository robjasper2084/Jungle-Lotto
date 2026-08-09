# Question authoring guide

## Production schema

Every production-playable question needs a stable lowercase slug ID, one of the seven registered categories, `easy`, `medium`, or `hard` difficulty, exactly four non-empty choices, a correct index from 0 through 3, a non-empty explanation, a valid review date, `reviewStatus: "approved"`, `active: true`, a positive version, and editor metadata.

Historical and scientific questions must include a recognizable source name and a maintained source URL. Paranormal material must distinguish reports, folklore, unresolved observations, and scientific conclusions. Never present an unexplained report as proof of an extraordinary cause.

## Local manager

Open `admin/` from a local HTTP server. The manager can:

- add, edit, preview, activate, and deactivate questions;
- search IDs, question text, and tags;
- filter by category and difficulty;
- reject duplicate IDs, missing explanations, invalid answer indexes, and any item without exactly four choices;
- import a JSON array or CSV file;
- export a complete JSON backup.

The editor name and timestamp are written on every local save. The browser cannot modify repository files or publish production data. Export the backup and submit it to repository review.

## CSV import

CSV headers may use the schema field names. Provide either a JSON-encoded `choices` column or `choice0`, `choice1`, `choice2`, and `choice3`. Separate tags with `|`. Standard quoted fields and doubled quotes are supported.

## Editorial source and regeneration

The reviewed starter content lives in `scripts/build-question-bank.mjs`. After an approved editorial change, run `npm.cmd run build`. This regenerates the category shards and manifest hashes and rejects invalid or undersized banks.

Correct answer positions are rotated during generation; authors should not manually force the correct answer into a preferred button.
