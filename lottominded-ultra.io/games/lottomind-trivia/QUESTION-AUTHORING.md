# Trivia Question Authoring

Question management is a local editorial workflow. No public browser route exposes editing controls or automatically rewrites the production bank.

## Required Record

Every question requires:

- stable lowercase `id`;
- supported `category`;
- `difficulty`: `easy`, `medium`, or `hard`;
- question text;
- exactly four unique answer choices;
- zero-based `correctChoiceIndex`;
- useful explanation;
- source name and HTTP(S) source URL;
- `reviewedAt` in `YYYY-MM-DD` format;
- `reviewStatus`: `draft`, `review`, `approved`, or `rejected`;
- `active` boolean;
- tags and positive version number;
- `lastEditedBy` and `lastEditedAt`.

Approved records must identify an editor. A question can be removed from play without deleting its history by setting `active` to `false` and increasing its version.

## Commands

```powershell
npm.cmd run trivia:questions -- list
npm.cmd run trivia:questions -- search --query Detroit --category detroit-history-culture --difficulty hard
npm.cmd run trivia:questions -- preview --id detroit-history-culture-10
npm.cmd run trivia:questions -- validate --input questions.json
npm.cmd run trivia:questions -- import --input questions.json --output validated-questions.json
npm.cmd run trivia:questions -- export --approved-only --output approved-backup.json
npm.cmd run trivia:questions -- upsert --input question.json --output updated-bank.json
```

`import`, `export`, and `upsert` always write to an explicit output file. They never overwrite `src/questions.mjs` automatically. This preserves a review checkpoint before code changes.

## Review Procedure

1. Export the current bank as a backup.
2. Prepare new or edited records in JSON.
3. Validate the complete collection.
4. Review wording, answer position, explanation, licensing, source authority, and entertainment-only language.
5. Set approved records active only after editorial review.
6. Update the source module in a focused commit.
7. Run `npm.cmd run trivia:test` and browser tests.

Do not copy restricted question banks or long copyrighted text. Prefer original wording and authoritative public sources.
