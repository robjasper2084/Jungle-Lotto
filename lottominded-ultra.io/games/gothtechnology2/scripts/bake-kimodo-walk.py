"""Bake the approved SOMA walk into the existing contact-IK row layout."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil

import numpy as np
from scipy.spatial.transform import Rotation, Slerp

PACK = Path(__file__).resolve().parents[1]


def unit(vector):
    return vector / np.linalg.norm(vector)


def frame(side, up):
    up = unit(up)
    side = unit(side - up * np.dot(side, up))
    return np.column_stack((side, up, np.cross(side, up)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    args = parser.parse_args()
    source = args.source.resolve()
    names = json.loads((PACK / "swoop-source/art/kimodo-recovery/skeleton.json").read_text())
    idx = {name: i for i, (name, _) in enumerate(names)}
    with np.load(source / "motion.npz", allow_pickle=False) as data:
        joints, roots = data["posed_joints"], data["root_positions"]
    # Matching left-foot forward extrema bound one steady two-step cycle.
    lo, hi, samples = 94, 136, 65
    heading = roots[hi] - roots[lo]
    yaw = np.arctan2(heading[0], heading[2])
    inverse = Rotation.from_euler("y", -yaw).as_matrix()
    leg_length = float(np.mean([
        np.linalg.norm(joints[lo, idx[side + "Shin"]] - joints[lo, idx[side + "Leg"]])
        + np.linalg.norm(joints[lo, idx[side + "Foot"]] - joints[lo, idx[side + "Shin"]])
        for side in ("Left", "Right")
    ]))
    rows = []
    for f in range(lo, hi + 1):
        p = joints[f]
        row = np.zeros(51)
        for side, start in (("Left", 0), ("Right", 6)):
            for offset, a, b in ((0, "Leg", "Shin"), (3, "Shin", "Foot"), (12, "Arm", "ForeArm"), (15, "ForeArm", "Hand")):
                row[start + offset:start + offset + 3] = unit(inverse @ (p[idx[side + b]] - p[idx[side + a]]))
            foot, toe = p[idx[side + "Foot"]], p[idx[side + "ToeBase"]]
            row[24 + start // 2] = (inverse @ (foot - roots[f]))[2]
            floor = min(p[idx[side + suffix], 1] for suffix in ("Foot", "ToeBase", "ToeEnd"))
            row[25 + start // 2] = floor
            direction = inverse @ (toe - foot)
            row[26 + start // 2] = -np.arctan2(direction[1], direction[2])
        for offset, side_a, side_b, up_a, up_b in (
            (30, "RightLeg", "LeftLeg", "Hips", "Spine2"),
            (34, "RightArm", "LeftArm", "Spine2", "Neck1"),
            (47, "RightEye", "LeftEye", "Neck2", "Head"),
        ):
            matrix = frame(inverse @ (p[idx[side_b]] - p[idx[side_a]]), inverse @ (p[idx[up_b]] - p[idx[up_a]]))
            row[offset:offset + 4] = Rotation.from_matrix(matrix).as_quat()
        for k, side in enumerate(("Left", "Right")):
            row[38 + k * 3:41 + k * 3] = unit(inverse @ (p[idx[side + "Arm"]] - p[idx[side + "Shoulder"]]))
        row[44:47] = inverse @ roots[f]
        rows.append(row)
    rows = np.asarray(rows)
    for offset in (25, 28):
        rows[:, offset] = np.maximum(0, rows[:, offset] - np.percentile(rows[:, offset], 5))
    for offset, lift in ((26, 25), (29, 28)):
        rows[:, offset] -= np.median(rows[rows[:, lift] < .01, offset])
    t = np.linspace(0, 1, len(rows))
    # Remove translation and slow drift; the controller owns traveled distance.
    for offset in (44, 45, 46):
        rows[:, offset] -= np.linspace(rows[0, offset], rows[-1, offset], len(rows))
        rows[:, offset] -= rows[:, offset].mean()
    quaternions = {offset: rows[:, offset:offset + 4].copy() for offset in (30, 34, 47)}
    rows -= t[:, None] * (rows[-1] - rows[0])[None]
    for offset, values in quaternions.items():
        rotation = Rotation.from_quat(values)
        correction = (rotation[-1].inv() * rotation[0]).as_rotvec()
        closed = rotation * Rotation.from_rotvec(t[:, None] * correction[None])
        rows[:, offset:offset + 4] = closed.as_quat()
    target_t = np.linspace(0, 1, samples)
    baked = np.stack([np.interp(target_t, t, rows[:, k]) for k in range(51)], axis=-1)
    for offset in (30, 34, 47):
        baked[:, offset:offset + 4] = Slerp(t, Rotation.from_quat(rows[:, offset:offset + 4]))(target_t).as_quat()
    for offset in (*range(0, 24, 3), 38, 41):
        baked[:, offset:offset + 3] /= np.linalg.norm(baked[:, offset:offset + 3], axis=1, keepdims=True)
    baked[-1] = baked[0]
    assert np.isfinite(baked).all()
    art = PACK / "ride-core/art/kimodo-walk"
    art.mkdir(parents=True, exist_ok=True)
    for name in ("motion.npz", "meta.json", "validation.json"):
        shutil.copy2(source / name, art / name)
    metadata = {
        "id": "kimodo-relaxed-walk-v1", "generator": "NVIDIA Kimodo SOMA-RP v1.2",
        "sourceSha256": hashlib.sha256((source / "motion.npz").read_bytes()).hexdigest(),
        "sourceFrames": [lo, hi], "sourceFps": 30, "samples": samples,
        "duration": (hi - lo) / 30, "cycleDistance": float(np.linalg.norm(heading[[0, 2]])),
        "legLength": leg_length, "armEdit": "Approved relaxed-arms revision, 30 percent toward original",
        "translation": "Removed for distance-driven controller phase; existing IK fits actual shoes and limb lengths",
    }
    payload = {**metadata, "frames": np.round(baked, 6).tolist()}
    (PACK / "ride-core/src/kimodoWalkData.ts").write_text(
        "// Generated by scripts/bake-kimodo-walk.py from the approved local Kimodo clip.\n"
        + "export const KIMODO_WALK_DATA = " + json.dumps(payload, separators=(",", ":")) + ";\n",
        encoding="utf-8",
    )
    (art / "manifest.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
