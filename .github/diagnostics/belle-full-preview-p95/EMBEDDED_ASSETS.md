# Embedded image provenance contract

This module repairs the diagnostic's asset model. It does not change the application, accepted frame limits, original driver, capture duration, or failed PR268 evidence. The first attempt's 63 rejected Blob responses have no retained body bytes. The second attempt retained three image bodies but could not bind them because their source GLBs existed in gzip delivery containers. Both attempts retain their original collection failures; this extension does not retrospectively make either collection complete.

## API

```js
const index = await buildEmbeddedAssetIndex(distDir, verifiedFiles);
const fresh = await verifyEmbeddedAssetIndex(distDir, verifiedFiles, archivedIndex);
const allMatches = matchEmbeddedImage(fresh, responseBytes, rawContentType);
```

`verifiedFiles` is the exact independently verified build inventory, with `file`, `bytes`, and lowercase SHA-256 `sha256` fields. The module canonicalizes the inventory and rejects duplicate/unsafe names. It rechecks every `.glb`, `.glb.gz` and referenced external image it reads. It does not replace the caller's complete build/archive verification.

`buildEmbeddedAssetIndex` returns a JSON-serializable object with `version:1`, `format:'belle-glb-embedded-images-v1'`, `manifestSha256`, `sources`, `candidates`, and `externalImages`. Files are ordered lexically; image indices retain source order. Equivalent images are never deduplicated.

Each candidate records `sourceFile`, `sourceBytes`, `sourceSha256`, `imageIndex`, `mimeType`, payload `bytes`/`sha256`, and `storage`:

| Storage kind | Provenance |
| --- | --- |
| `glb-bin-buffer-view` | Logical buffer and bufferView indices/lengths/offsets, BIN chunk location, exact absolute source-byte start and exclusive end |
| `image-data-uri` | Image URI JSON pointer, encoding, URI hash/length, exact source UTF-8 JSON-string start/exclusive-end, decoded length/hash |
| `data-uri-buffer-view` | Logical decoded-buffer view indices/offsets plus the buffer URI's exact JSON-string span, encoding, and hashes |
| `gzip-decoded-glb-image` | Compressed source identity remains in `sourceFile`/`sourceBytes`/`sourceSha256`; `decodedGLB` binds the decoded GLB length and SHA-256, and `decodedStorage` contains one of the preceding storage records with `offsetBasis:'decompressed-glb'` on the wrapper |

Data URI byte positions describe the encoded JSON string. The module does not invent an absolute file offset for decoded payload octets that have no contiguous representation in the GLB.

For a gzip source, `sources` retains the compressed manifest identity and a `compression` record identifying the single member's header, DEFLATE span, trailer, CRC32, ISIZE and output bound. Its GLB chunk positions live under `decodedGLB`, alongside the decoded length/hash. They are not positions in the gzip file. The same distinction holds for all nested image and JSON-string positions. Direct GLB records retain their original structure and values; adding a gzip copy preserves all additional matching image candidates.

`verifyEmbeddedAssetIndex` rebuilds from exact file bytes, compares the complete structure, and returns the **freshly rebuilt** object. `matchEmbeddedImage` is synchronous and requires a freshly built or independently verified index. It returns all full candidate records matching MIME, length, and SHA-256. It throws for unknown images; it does not return an empty success or select one ambiguous origin. `canonicalImageMime` explicitly trims and lowercases a supported MIME and rejects MIME parameters/unknown types.

## Supported scope

- GLB container version 2 containing one JSON chunk followed by zero or one BIN chunk. Declared lengths, ordering, four-byte chunk alignment, JSON UTF-8, asset version, duplicate JSON keys, source bounds, logical BIN length and zero padding are checked. Unknown chunks and standalone `.gltf` / `.gltf.gz` files are unsupported and fail closed.
- Exact-manifest `.glb.gz` files containing one gzip DEFLATE member with the pinned build's zero-flags header. Decoding is bounded by the declared ISIZE and a hard 128 MiB maximum per container; the decoded byte length and CRC32 must match. The consumed DEFLATE span plus its exact header/trailer must exhaust the compressed file. Optional headers, concatenated members (including empty members), trailing zero/junk bytes, truncation, CRC/ISIZE mismatches and unsupported decoded GLB content fail. This is offline source verification; it does not change the application's decoder or any collection deadline.
- glTF asset version `2.0` with optional minimum version `2.0`. The index validates the image storage needed for provenance; it is not a complete geometry/animation/glTF validator. An unrelated no-image meshopt fallback buffer is not treated as embedded image storage.
- PNG and JPEG image bytes only. The MIME must agree with the format signature. The module does not decode or repair image data. Other image formats are deliberately unsupported until separately reviewed and tested.
- Image bufferViews into the first GLB BIN buffer, or into an explicit base64 `application/octet-stream` / `application/gltf-buffer` data-URI buffer. References cannot consume logical-buffer padding or overrun the declared buffer. External image buffers, image-related extensions, strided/vertex-layout image views, missing MIME, and ambiguous URI-plus-bufferView declarations fail.
- Explicit image data URIs containing strict canonical base64, or percent-encoded bytes with only unreserved ASCII left unescaped. Missing/unknown MIME, parameters, malformed encodings, invalid pad bits, whitespace in base64, and inconsistent declared MIME fail.
- Ordinary relative external image references are resolved inside the exact inventory, read and hash-verified, and recorded in `externalImages` with `blobBinding:false`. They cannot authorize a Blob response. An escaping, nonlocal, missing, or unsupported reference fails.

The [Khronos glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html) defines GLB2 chunks, BIN padding, image bufferViews, data URIs, and PNG/JPEG MIME signatures. This contract intentionally supports a narrower format set than a general glTF loader and rejects unsupported provenance instead of guessing.

## Integration requirements

The caller retains the complete raw response body before matching. Same-origin Blob URLs alone never establish provenance. The separate response verifier checks the exact game origin including port, response status, raw MIME, captured-file hash/length, capture completeness, and the unchanged absolute post-stop deadline; it compares the receipt's `embeddedMatches` to every match returned here. Unknown payload bytes remain retained alongside failure information.

A match proves that the exact image bytes occur in specified exact built sources. Identical images in several GLBs remain ambiguous; this module does not claim which source instance created a particular Blob URL. Prelaunch and final independent index reconstruction provide source-integrity checks; no runtime Blob hook, additional image request, or application instrumentation is necessary.

## Focused verification

Run `node --test .github/diagnostics/belle-full-preview-p95/embedded-assets.test.mjs` from the repair directory. The original 16 tests exercise exact offsets and duplicates; source/index mutation; strict MIME and payload matching; UTF-8 and data-URI spans; logical padding; external-image separation; symlink/path rejection; malformed GLB/JSON/ranges/extensions/encodings; typed-array slice boundaries; and the existing geometry-only meshopt fallback pattern. Ten additional tests cover compressed/decoded identity separation, all duplicate matches, decoded URI spans, external-image base paths, strict gzip headers/DEFLATE/CRC/ISIZE/bounds/member exhaustion, provenance mutation, and the unchanged response verifier's all-match and deadline checks. An independent archived-build browser fixture is a separate integration check.
