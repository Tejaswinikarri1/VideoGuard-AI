package com.videoguard.zones;

import java.util.ArrayList;
import java.util.List;

/** Normalized coordinates in [0,1], origin top-left. Same rules as the AI service (app/geometry.py). */
public final class PolygonValidator {
    private PolygonValidator() {}

    public static List<String> validate(List<List<Double>> poly) {
        List<String> errors = new ArrayList<>();
        if (poly == null || poly.size() < 3) { errors.add("polygon needs at least 3 points"); return errors; }
        if (poly.size() > 64) { errors.add("polygon has too many points"); return errors; }
        for (List<Double> p : poly) {
            if (p == null || p.size() != 2 || p.get(0) == null || p.get(1) == null || p.get(0).isNaN() || p.get(1).isNaN()
                    || p.get(0) < 0 || p.get(0) > 1 || p.get(1) < 0 || p.get(1) > 1) {
                errors.add("all points must be [x,y] within [0,1]");
                return errors;
            }
        }
        if (area(poly) < 1e-4) errors.add("polygon area is too small or degenerate");
        int n = poly.size();
        outer:
        for (int i = 0; i < n; i++) {
            for (int j = i + 1; j < n; j++) {
                if (Math.abs(i - j) == 1 || Math.abs(i - j) == n - 1) continue;
                if (cross(poly.get(i), poly.get((i + 1) % n), poly.get(j), poly.get((j + 1) % n))) {
                    errors.add("polygon edges must not self-intersect");
                    break outer;
                }
            }
        }
        return errors;
    }

    static double area(List<List<Double>> p) {
        double s = 0;
        for (int i = 0; i < p.size(); i++) {
            List<Double> a = p.get(i), b = p.get((i + 1) % p.size());
            s += a.get(0) * b.get(1) - b.get(0) * a.get(1);
        }
        return Math.abs(s) / 2.0;
    }

    private static double ccw(List<Double> a, List<Double> b, List<Double> c) {
        return (b.get(0) - a.get(0)) * (c.get(1) - a.get(1)) - (b.get(1) - a.get(1)) * (c.get(0) - a.get(0));
    }

    private static boolean cross(List<Double> a, List<Double> b, List<Double> c, List<Double> d) {
        return ccw(a, b, c) * ccw(a, b, d) < 0 && ccw(c, d, a) * ccw(c, d, b) < 0;
    }
}
