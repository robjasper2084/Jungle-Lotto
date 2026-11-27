# Retained native report parser, version 3

This is an offline interpretation repair for the already retained native stack
report. It changes no sampling, native inputs, process identity checks, renderer,
timing, overlap policy or original failure verdict. The original capture receipts
remain immutable; a new parser result must be presented as a separate posthoc
supplement, not substituted into the old receipt.

## Exact report regression

`fixtures/pr278-native-sample-report.txt` is the unmodified **335,445-byte** report,
SHA-256 `c65f96db61dbcc3f7b0849921093e08c4650230f22fd7006e3328a7aec0ebeeb`.

The native tool output uses legitimate syntax absent from the earlier fixtures:
repeated horizontal spacing, unknown symbols with load-address-relative offsets,
`Thread_<multiple>` groups, and collapsed comma-separated locations. One collapsed
row ends with explicit ellipses. The former parser exceeded its issue bound while
treating this syntax as malformed. Version 3 recognizes those forms without
raising the issue cap or concealing malformed input.

The exact report now produces:

| Observation | Retained result |
|---|---:|
| Raw physical lines | 2,183 |
| Root observation groups | 24 |
| Inclusive frame rows | 1,128 |
| Simple / collapsed frame rows | 1,119 / 9 |
| Displayed locations | 1,137 |
| Rows with explicitly omitted locations | 1 |
| Explicit unknown `???` frame rows | 68 |
| Named frame rows | 1,060 |
| Named rows with unresolved large offsets | 666 |
| Rows meeting the parser's conservative named-symbol criterion | 394 |
| Binary-image records | 969 |

These are report-row inventories, not independent samples, thread counts,
function-call counts, execution time, device time or causal frame-gap attribution.
The report supplies no global sample-count declaration; that field remains null.

## Lossless representation and limited interpretation

`rawLines` retains every line with its original line number and line terminator.
Concatenating `raw + lineEnding` reconstructs the original report exactly,
including mixed LF/CRLF endings or an absent final newline. Parsed root and frame
rows also retain raw text, line number, inclusive count and indentation prefix.

`threadRoots` contains **observation groups**. `Thread_<multiple>` records have
`kind: "multiple-thread-group"` and a null `threadId`. Other roots have
`kind: "thread-observation-group"` and retain the displayed identifier. Repeated
identifiers stay in separate root records. Every root's `distinctThreadCount`
remains null; 24 root groups do not establish 24 distinct threads.

Simple frame rows retain the existing scalar `address` and `offsetBytes` fields.
`locations` additionally retains each address, exact offset token and its safely
represented numeric offset. `locationKind` distinguishes symbol-relative,
load-address-relative and address-only forms. Unknown load-address rows retain
the original `???` symbol and base address. Their base plus relative offset must
match the displayed address; this arithmetic does not resolve the unknown symbol.

Collapsed frame rows retain their locations as an ordered array, with
`collapsed: true`. Their scalar address and offset are null to avoid choosing a
favored location. The original inclusive count belongs to the row once; the
parser neither distributes it across locations nor replicates it per location.
When either location list ends in `...`, both must do so at the same position and
`locationsComplete` is false. No missing address or offset is invented.

A displayed name is recorded separately from conservative symbolization.
`namedFrameRows` includes unresolved named exports, while
`unresolvedNamedFrameRows` tracks large offsets or incomplete location coverage.
Offsets above 4,096 bytes from a displayed name are retained as
`largeOffset: true` and `symbolized: false`. In particular, the report's 662
`ChromeMain` rows are not 662 recovered internal Chrome functions. A small named
offset is still only an observed label; it does not prove complete symbol
resolution. `unknownSymbolFrameRows` retains the explicit unknown/malformed count
separately. `symbolCoverage` remains partial for this report and
`mechanismAttributionUsable` remains null.

## Validation and bounds

The original limits remain: 64 MiB report bytes, 250,000 split-line records,
1,024 roots, 100,000 frame rows, 10,000 binary-image rows, 10,000 unparsed graph
lines and 1,000 issues. Invalid data still records an issue or throws at the
existing bound. Unexpected post-address text is retained but rejected rather
than treated as a recognized annotation.

New location syntax has its own conservative limits: at most **1,024 displayed
locations per row** and **100,000 retained locations in total**. Splitting is
capped before allocating per-row arrays; aggregate capacity is checked before
constructing location objects. Native addresses and hexadecimal load offsets
must contain at most 16 hex digits, and numeric offsets must be safe integers.
Large numeric strings therefore never reach unbounded `BigInt` conversion.

Offset/address list lengths and ellipsis positions must match. Mid-list ellipses,
missing values, unsafe offsets, load-address sum mismatches, named load-address
misuse, ambiguous double offsets, fake root tokens and unrecognized lines remain
failures. Every rejected raw line remains in the retained report representation.
Image names must be nonempty after trimming, with balanced parentheses that never
close before they open. A greedy match therefore cannot consume an invalid offset
as part of an image name, while actual parenthesized image names remain supported.

The focused tests exercise the exact native report, raw round-trip equality,
grouped/repeated roots, all nine collapsed rows, unknown and unresolved symbols,
old fixture syntax, meaningful malformed cases and every original/new resource
bound. These tests are offline and launch no browser or native sampler.
