import json
import subprocess
from fractions import Fraction


class MetadataError(RuntimeError):
    pass


def probe_video(path: str, timeout: int = 30) -> dict:
    """Metadata from the actual file via FFprobe. Raises MetadataError rather than returning guesses."""
    try:
        p = subprocess.run(
            ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
            capture_output=True, text=True, timeout=timeout)
    except FileNotFoundError as e:
        raise MetadataError("ffprobe not found on PATH") from e
    except subprocess.TimeoutExpired as e:
        raise MetadataError("ffprobe timed out") from e
    if p.returncode != 0:
        raise MetadataError(f"ffprobe failed: {p.stderr.strip()[:200]}")
    data = json.loads(p.stdout or "{}")
    v = next((s for s in data.get("streams", []) if s.get("codec_type") == "video"), None)
    if v is None:
        raise MetadataError("no decodable video stream")
    try:
        fps = float(Fraction(v.get("avg_frame_rate", "0/1")))
    except (ZeroDivisionError, ValueError):
        fps = 0.0
    dur = v.get("duration") or data.get("format", {}).get("duration")
    return {"durationSeconds": float(dur) if dur else None, "width": int(v["width"]), "height": int(v["height"]),
            "frameRate": round(fps, 3), "codec": v.get("codec_name"),
            "container": data.get("format", {}).get("format_name")}
