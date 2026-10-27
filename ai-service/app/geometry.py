"""Normalized coordinate system: x,y in [0,1], origin top-left, y grows downward.
Frontend zone editor, backend storage and this service all use this convention."""
from typing import Sequence

Point = tuple[float, float]


def point_in_polygon(p: Point, poly: Sequence[Point]) -> bool:
    """Ray casting. Boundary points are treated as inside-or-outside consistently (not specified)."""
    x, y = p
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if x < xi:
                inside = not inside
    return inside


def polygon_area(poly: Sequence[Point]) -> float:
    s = 0.0
    for i in range(len(poly)):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % len(poly)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0


def _ccw(a: Point, b: Point, c: Point) -> float:
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def _segments_cross(a: Point, b: Point, c: Point, d: Point) -> bool:
    return (_ccw(a, b, c) * _ccw(a, b, d) < 0) and (_ccw(c, d, a) * _ccw(c, d, b) < 0)


def validate_polygon(poly: Sequence[Point], min_area: float = 1e-4) -> list[str]:
    """Return a list of validation errors (empty == valid)."""
    errors: list[str] = []
    if len(poly) < 3:
        return ["polygon needs at least 3 points"]
    if any(not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0) for x, y in poly):
        errors.append("all points must be within [0,1] normalized coordinates")
    if polygon_area(poly) < min_area:
        errors.append("polygon area is too small or degenerate")
    n = len(poly)
    for i in range(n):
        for j in range(i + 1, n):
            if abs(i - j) in (1, n - 1):
                continue
            if _segments_cross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n]):
                errors.append("polygon edges must not self-intersect")
                return errors
    return errors
