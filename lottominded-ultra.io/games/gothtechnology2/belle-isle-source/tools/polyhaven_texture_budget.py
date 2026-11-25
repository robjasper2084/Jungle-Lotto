"""Byte-budget retries for opaque source-verified GLBs, independent of Blender."""

class GlbByteBudgetError(ValueError):
    """Only this exception allows a lower-resolution export retry."""

def resolution_attempts(tier):
    cap = tier["maxTexture"]
    if tier["name"] != "high":
        return (cap,)
    # Largest admissible texture first. Never enlarge the original cap,
    # or silently retry geometry, PBR, source identity or format failures.
    return tuple(dict.fromkeys([cap] + [n for n in (1536, 1280, 1024) if n < cap]))

def export_with_budget(tier, export_once):
    attempts = []
    for limit in resolution_attempts(tier):
        try:
            result = export_once(limit)
        except GlbByteBudgetError as exc:
            attempts.append({"textureLimit": limit, "status": "over-budget", "reason": str(exc)})
            continue
        attempts.append({"textureLimit": limit, "status": "review"})
        return {**result, "effectiveTextureLimit": limit, "textureAttempts": attempts}
    raise GlbByteBudgetError("All texture limits exceeded original GLB cap: " + repr(attempts))
