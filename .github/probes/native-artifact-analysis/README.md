# Retained native trace analysis

This draft analyzes the existing original-210 diagnostic artifact from run **45987971947**, attempt **1**, head **a8e8b97a531d57b3c2b5b23d99aa0636d4c8dd25**. The source application remains original759. The analysis was prepared after the shared execution workspace became unavailable.

## Fixed input

- Repository: `robjasper2084/Jungle-Lotto`
- Artifact: `15193147198`, `native-compositor-original-210-7590627-NOT-RELEASE`
- ZIP bytes: **44,195,073**
- ZIP SHA-256: **a07aad68f8970a53c9ac979fd94fbf04ba2587f09b1cf5adfda396fa0aba3aad**
- Source job: **140468316334**
- Source run conclusion: **failure**

The completed capture logs report p95 **82.5 ms**, maximum **383.3 ms**, two eligible intervals above250ms, source/build preserved, and `diagnosticComplete:false`. This is an instrumented observation of unchanged application code. It does not establish a runtime improvement or regression, and it does not grant release acceptance.

## Workflow

The single Linux analysis job checks out only this analysis payload. It validates syntax and offline downloader fixtures, then downloads the fixed artifact once. It verifies the run, attempt, head, artifact name, byte count and SHA-256 before reading the archive. Its Actions token is supplied only to GitHub's API; the signed storage download uses a fresh request without that authorization header.

The audits inspect retained source, driver, build, input, observer and terminal receipts. They validate the exact raw trace bytes, complete JSON/EOF, trusted-W clock mapping, named process/thread topology and category/flow coverage. This first analysis revision reports recording integrity, topology and raw RAF gaps. A separate interval/CPU timing reader is under review and is not part of this revision.

No game source is checked out, built, launched or modified by this workflow. It does not launch a browser, run a performance or controls case, alter prior results, or merge/deploy anything. Its new workflow run is an analysis of retained bytes, not a retry of the native test.

Audit steps keep collecting independent reports after a failed check. The final step fails if any required audit failed or was skipped. An incomplete recording cannot be relabeled complete by the offline reader. Raw inventory can still be retained with explicit blocked attribution.

## Source binding

`fixed.json` contains the capture identity, the published observer head/tree/parent and synthetic checkout identity, and the frozen nine-file observer hashes.

`observer-manifest.json` is the exact frozen source blob `641cff7f5c6d96271738a192780df34efd676f15`, including its original whitespace. Its SHA-256 is `04b84ed7ba6fd8181f229e76dc70354ec5dad19d328c7036010f3be3992d1aca`.

The unchanged Node streaming JSON parser comes from PR265 commit `b8fd4ccc564f231ff7f9b605379f417b6bd1d4bc`, blob `7cd2800adbcd140f1f476eb26543cc30cb6913d2`. Only that parsing implementation is reused; no performance data from the different PR265 application is evidence for this capture. JavaScript-decoded large numeric flow identifiers are not authoritative. This first revision does not join flow IDs or publish exact large-integer flow identities.

## Interpretation

CPU-service/compositor wall intervals do not measure hardware GPU execution. Thread CPU intervals are reported only where valid clock endpoints and interval containment support them; no linear interpolation of CPU time across a clipped wall interval is justified. Async events and flow rows remain distinct from synchronous thread execution.

Trace absence, loss, a byte cap, invalid clocks, missing tracks/categories/flows, unexpected session closure, failed final persistence or contradictory terminal receipts keeps the appropriate audit failed. The original source driver's verdict is retained independently.

The analysis records no release approval. Original90-second performance thresholds, all six original controls cases, their32-minute/90-second deadlines, every capture, actual GPU completion and two paint opportunities remain outstanding release gates.

## Review state

The source is reviewed through immutable Git objects. The unavailable local workspace means the new analysis code has not received a local execution result. Its first workflow run will execute the declared syntax and downloader fixtures before reading the frozen artifact, and will retain failures and reports. Nothing in this README claims those checks have already passed.
