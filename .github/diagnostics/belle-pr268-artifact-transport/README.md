# Transport the completed PR268 GPU-category artifact

This isolated utility transports bytes from the already completed native diagnostic. It does not extract the ZIP, build an application, rerun a browser or measurement, change a verdict, or publish anything itself.

The production command pins repository `robjasper2084/Jungle-Lotto`, repository ID `1216655619`, completed source run `45983706110`, head `2806fbd4f9b445177b0fd37c6a417ec844312d30`, artifact `15190968508`, length `556392705`, and SHA256 `2f3d33a7057b941cf2433d3e53bf9a8437f373d04ddf64fe18cfcb9886d39776`. There are no command-line identity, digest or part-size overrides.

```sh
python3 transport_test.py
python3 transport.py NEW_OUTPUT_DIR
```

The transport command reads `GH_TOKEN` from the environment. The caller must provide a new output directory whose parent already exists. Existing output directories and part files are never overwritten. The tests use small injected bytes and mock HTTP responses; they make no network requests.

## Sequence and receipts

1. Read the pinned artifact and run metadata through GitHub's API. Verify artifact ID, exact size and digest, unexpired state, source run/head/branch and repository IDs; verify the run is completed and belongs to the pinned repository. Preserve both raw metadata objects. A failed original run is permitted: transport does not revise its conclusion.
2. Download the original byte stream into `original-artifact.zip.partial`. Verify its exact complete size and SHA256 before creating any parts. Oversized responses fail on the first excess byte; truncated or hash-mismatched bytes remain as failed partial input.
3. Exclusively promote the verified file to `original-artifact.zip`. Read it sequentially into fixed-size parts, rechecking the original digest while splitting.
4. Stream the ordered part files again to reconstruct the original digest. Require canonical filenames, nonempty contiguous ranges, exact file set, exact lengths, per-part hashes and the pinned complete hash. No second full ZIP is written by this check.
5. Write `manifest.json` only after successful reconstruction.

The fixed part layout is:

| Filename | Offset | Bytes |
| --- | ---: | ---: |
| `original-artifact.part-000.bin` | 0 | 268435456 |
| `original-artifact.part-001.bin` | 268435456 | 268435456 |
| `original-artifact.part-002.bin` | 536870912 | 19521793 |

The manifest contains `version`, explicit transport-only scope flags, the six-field `original` identity (`repository`, `runId`, `head`, `artifactId`, `bytes`, `sha256`), both full metadata objects, `partSize`, `verifiedBeforeSplit`, the ordered `parts` rows (`file`, `offset`, `bytes`, `sha256`), the verified `reconstruction`, and sanitized HTTP observations.

The workflow uploads each part separately with compression level zero, plus a separate artifact containing exactly `manifest.json`. Each resulting part ZIP has its canonical part filename at the root. A fifth small artifact retains metadata and logs, including failure receipts. Local reconstruction uses the three part ZIPs and the single-manifest ZIP; the additional receipts archive is separate. The original archive remains untouched by extraction or execution.

This transport-only revision is a separate child of the completed diagnostic head. Its workflow paths do not match the existing native diagnostic's path filter. The original native log reports 49.6 ms p95 and zero eligible intervals over 250 ms with `releaseAcceptance:false`; the original uninstrumented #261 desktop failures remain authoritative. Full original-artifact validation and timing analysis are still required after transport.

## Credential and failure handling

Only requests to HTTPS `api.github.com` receive the GitHub bearer token. Automatic redirects are disabled. Each redirect is manually checked for HTTPS, no credentials or fragment, default/443 port, and an explicit standard GitHub storage-host allowlist. Storage requests receive fresh headers without GitHub authorization. Unknown destinations fail; there is no permissive fallback or silent retry.

The allowed destinations cover GitHub Actions `productionresultssa<number>.blob.core.windows.net` storage, `actions.githubusercontent.com` subdomains, GitHub object/release-asset hosts, and GitHub production S3 bucket hosts. Destination identity comes only from the pinned API response or a checked storage redirect. Neither a hostname nor a signed URL substitutes for the final exact archive digest.

Logs retain only stage, fixed failure code, received-byte/hash progress and HTTP hostname/status/authentication-presence observations. Tokens, redirect URLs, query strings, Location headers and third-party exception messages are never persisted. On a failure after output creation, `failure.json`, `transport-log.jsonl`, received metadata and actual partial files remain; `manifest.json` is absent. Pre-existing output rejection does not modify that directory.

`verify_parts()` is reusable for bounded verification of the ordered raw parts. It never writes or overwrites a reconstructed artifact. A separate local assembler must also validate the download ZIP packaging and refuse existing output paths before writing the original archive. The transport does not turn an unverified archive into complete timing evidence: the normal original-artifact provenance and raw-trace replay remain mandatory afterward.
