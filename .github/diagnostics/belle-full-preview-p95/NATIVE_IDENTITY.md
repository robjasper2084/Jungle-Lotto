# Native GPU sampler: browser command identity

This document describes the narrowly qualified command-line comparison used by
the diagnostic-only native GPU sampler. It does not change the game, its browser
launch arguments, its rendering backend, or any release acceptance criterion.

## The retained failure

The first PR #278 native collection, at diagnostic commit
`2ae9fb4c13d1f5498cfcd709da9d18a276c1e913`, stopped during initial process
validation. The collector assumed that the complete flattened command reported
by CDP `SystemInfo.getInfo` must equal the command displayed by macOS `ps`.

The archived browser command has 43 ordered OS switches. The CDP command has
that identical prefix followed by exactly these three tokens:

```text
--flag-switches-begin --flag-switches-end --enable-unsafe-swiftshader
```

The original OS prefix already contains one bare
`--enable-unsafe-swiftshader`; CDP therefore contains two occurrences. The
initial receipt identifies browser PID 9678, GPU PID 9685, GPU parent PID 9678,
and real/effective UID 501, with executables in the same Google Chrome bundle.
These are initial observations, not proof of stability over a sample interval.

The OS sampler never launched. `sample`, `analysis`, `beforeSnapshot`, and
`afterSnapshot` are null, and its three raw output files are absent. That
capture remains `collectionComplete=false` and `validationPassed=false`.
Replaying its command observation with a corrected comparator does not make
the historical capture successful or supply missing native stacks.

## Exact browser source basis

The observed browser is `Chrome/158.0.8127.89`, reporting Chromium revision
`@1de57fa19722fa6d6841d4f596c394d015580656`. The source links below use that
exact revision in Chromium's official GitHub mirror. A reported source revision
is a source applicability bound; it is not a reproduction of the installed
browser binary, its build configuration, or its driver.

| Source | Relevant behavior |
| --- | --- |
| [SystemInfo handler](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/content/browser/devtools/protocol/system_info_handler.cc) | `SendGetInfoResponse` obtains `base::CommandLine::ForCurrentProcess()` and serializes its `GetCommandLineString()`. CDP returns the current in-memory command representation, not an OS argv query. |
| [Command-line implementation](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/base/command_line.cc) | POSIX initialization copies argv into the current-process object. `AppendSwitchNative` changes that object and appends a token to its vector, preserving duplicate displayed occurrences. `GetArgumentsStringInternal` and `GetCommandLineString` serialize that vector; POSIX output is flattened rather than shell-escaped. |
| [Feature-list startup](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/chrome/browser/metrics/chrome_feature_list_creator.cc) | `ConvertFlagsToSwitches` applies preference-backed flags to the current-process command object with `flags_ui::kAddSentinels`. |
| [Flag conversion](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/components/webui/flags/flags_state.cc) | `AddSwitchesToCommandLine` appends a begin sentinel, enabled flag entries, and an end sentinel. An adjacent empty sentinel pair has a direct startup source basis. At this revision the path is `components/webui/flags`, not the historical `components/flags_ui` path. |
| [Browser startup](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/chrome/browser/chrome_browser_main.cc) | Browser startup can append `kEnableUnsafeSwiftShader` to the current-process command when the corresponding Local State preference is true. That append does not first check whether the switch is already present. |
| [Preference registration](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/chrome/browser/chrome_content_browser_client.cc) | The Local State unsafe-SwiftShader preference is registered with default `false`. The observed suffix is not established to be a Chrome-for-Testing default. |
| [Policy mapping](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/chrome/browser/policy/configuration_policy_handler_list_factory.cc) | A policy can supply the preference. This source path does not prove which policy or preference, if any, produced the observation on the runner. |
| [GL feature selection](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/ui/gl/gl_features.cc) | `IsSwiftShaderAllowed` tests presence with `HasSwitch`. An identical second bare occurrence does not change that presence test. Permission for software fallback is separate from the active rendering backend. |
| [GL switch definitions](https://github.com/chromium/chromium/blob/1de57fa19722fa6d6841d4f596c394d015580656/ui/gl/gl_switches.cc) | The unsafe-SwiftShader switch permits WebGL software fallback and is among switches copied to the GPU process. `use-angle` separately selects the requested ANGLE implementation. |

`AppendSwitchNative` normally assigns a switch value in a map while retaining
each displayed token in the vector; it also supports a custom duplicate-switch
handler. The qualification here does not generalize duplicate semantics to all
switches or browser builds. The relevant narrower fact is that this particular
fallback-permission test uses `HasSwitch`, and the same bare flag already exists
in the original OS command. No new fallback permission is inferred or admitted.
The source does not establish the actual origin of the runner's extra token.

## Accepted comparison relations

Both inputs remain bounded, nonempty observations of a controlled switch-only
launch. Keep the existing parser's restrictions on executable prefixes, control
characters, quoting, escaping, positional arguments, and whitespace-bearing
values. Neither flattened string is described as a lossless recovered argv
vector.

The comparator accepts either of these relations:

1. **Raw equality.** The two complete raw command strings are equal, and their
   parsed ordered switch vectors agree. All independent native-launch and
   process checks still apply.
2. **Pinned startup extension.** For the exact product and Chromium revision
   above, the OS vector contains exactly 43 switches and the CDP raw string is
   exactly the OS raw string plus one space and the three-token suffix shown
   above. The ordered CDP vector has the complete unchanged OS vector as its
   prefix and exactly that suffix. The OS prefix contains no flag sentinels and
   exactly one occurrence of the `enable-unsafe-swiftshader` switch name, whose
   token is bare and exact. This excludes a new permission, valued forms,
   conflicting duplicates, nonempty sentinel blocks, reordering, and arbitrary
   additions.

Do not sort, deduplicate, rewrite, or discard tokens. Keep both complete raw
strings, both ordered vectors, the full observed difference, the selected
relation, and its pinned source basis in the receipt. A source-qualified
extension is recorded as such; it is never labeled raw equality. Independent
replay recomputes the relation from preserved observations rather than trusting
the stored verdict.

## Independent identity and renderer safeguards

Retain the unique CDP browser/GPU pair, OS/CDP PID agreement, same real and
effective user without elevation, direct GPU-parent relation, same official
Chrome bundle, and exactly one GPU process-type argument. Preserve fresh
before/after comparisons of PID, parent, user, start time, executable, resolved
executable, and complete OS arguments, together with the existing nondecreasing
CPU-time checks.

Both complete browser switch vectors still require exactly one each of
`--enable-gpu`, `--use-gl=angle`, and `--use-angle=metal`, with their exact values.
Keep the guards against conflicting GPU settings and extra tracing or logging.
The approved suffix does not exempt either vector from these checks.

Actual rendering evidence is independently required. The failed capture's
SystemInfo reports `displayType=ANGLE_METAL`,
`glImplementationParts=(gl=egl-angle,angle=metal)`, and an Apple Metal renderer.
Those observations do not turn the failed sampler into a successful capture.
A future capture must satisfy its own native-backend checks and retain the
original driver evidence. Presence of `enable-unsafe-swiftshader` alone proves
neither software rendering nor native rendering.

## Fresh, timed CDP snapshots

The corrected collection obtains a bounded `SystemInfo.getInfo` observation for
each initial, immediately-before-sample, and immediately-after-sample identity
snapshot. It records the request/receipt host timestamps and full response,
then uses that snapshot's command string for cross-source comparison. Preserve
the associated timed process-list and OS observations. Validate source identity
and backend observations before and after the sampling interval.

The existing launch-time SystemInfo response remains preserved as its own
observation. It must not be copied into later snapshots and labeled freshly
observed. CDP timeout, missing response, changed representation, changed native
backend, or failed process identity causes collection failure. Do not retry
automatically or replace missing observations with earlier values.

This additional evidence collection preserves the original requested 90-second
ride, driver, native inputs, settings, clocks, deadlines, and exit-priority
rules. The OS sampler remains a single bounded 8-second request at 10 ms;
successful collection requires proof of the original sampling-window overlap.

## Regression and acceptance boundaries

Test the preserved real 43/46-switch observation and raw-equal observations.
Reject prefix edits and reordering, unknown or reordered suffixes, additional
tokens, nonempty or repeated sentinel blocks, missing or valued original
unsafe-SwiftShader flags, unqualified browser revisions, ambiguous flattened
representations, process substitution, changed birth or OS arguments, backend
changes, and tampered comparison receipts. Fresh-observation tests must reject
missing, stale, or untimed CDP responses rather than reusing launch evidence.

Passing these collector tests only qualifies the collector repair. It supplies
no native stacks by itself, attributes no runtime stall, and demonstrates no
game performance improvement. The original failed capture remains failed. A
new capture must independently establish complete collection, usable native
symbols and attribution, and the unchanged diagnostic contract before any
application runtime repair is selected. Release acceptance remains separate.
