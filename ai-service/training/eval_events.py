"""Event-level evaluation against human-labeled events (used to CALIBRATE and report the loitering/running/intrusion/weapon rules).

Ground truth JSON:  [{"video":"a.mp4","type":"SUDDEN_RUNNING","start":3.0,"end":5.0}, ...]
Predictions JSON:   {"a.mp4":[{"eventType":"SUDDEN_RUNNING","startTimeSeconds":3.2,"endTimeSeconds":5.1}, ...], ...}
                    (the `events` list from a completed AI job result, one entry per video)

A prediction matches a ground-truth event of the same type when temporal IoU >= --iou (default 0.3); each GT event matches at most once.
  python -m training.eval_events --gt gt.json --pred pred.json"""
import argparse
import json
from collections import defaultdict


def tiou(a0: float, a1: float, b0: float, b1: float) -> float:
    inter = max(0.0, min(a1, b1) - max(a0, b0))
    union = (a1 - a0) + (b1 - b0) - inter
    return inter / union if union > 0 else 0.0


def evaluate(gt: list[dict], pred: dict[str, list[dict]], iou: float = 0.3) -> dict:
    by_type: dict[str, dict] = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0})
    videos = {g["video"] for g in gt} | set(pred)
    for v in videos:
        for typ in {g["type"] for g in gt if g["video"] == v} | {p["eventType"] for p in pred.get(v, [])}:
            g = [x for x in gt if x["video"] == v and x["type"] == typ]
            p = sorted([x for x in pred.get(v, []) if x["eventType"] == typ], key=lambda x: x["startTimeSeconds"])
            used: set[int] = set()
            for e in p:
                best, bi = 0.0, -1
                for i, x in enumerate(g):
                    if i in used:
                        continue
                    s = tiou(e["startTimeSeconds"], e["endTimeSeconds"], x["start"], x["end"])
                    if s > best:
                        best, bi = s, i
                if bi >= 0 and best >= iou:
                    used.add(bi); by_type[typ]["tp"] += 1
                else:
                    by_type[typ]["fp"] += 1
            by_type[typ]["fn"] += len(g) - len(used)
    out = {}
    for typ, c in by_type.items():
        p = c["tp"] / (c["tp"] + c["fp"]) if c["tp"] + c["fp"] else None
        r = c["tp"] / (c["tp"] + c["fn"]) if c["tp"] + c["fn"] else None
        f1 = 2 * p * r / (p + r) if p and r else (0.0 if p is not None and r is not None else None)
        out[typ] = {**c, "precision": p, "recall": r, "f1": f1}
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--gt", required=True); ap.add_argument("--pred", required=True); ap.add_argument("--iou", type=float, default=0.3)
    a = ap.parse_args()
    print(json.dumps(evaluate(json.load(open(a.gt)), json.load(open(a.pred)), a.iou), indent=2))
