package com.videoguard.users;

/** Password policy: >= 10 chars with upper, lower and digit. Mirrors the frontend validator. */
public final class Passwords {
    private Passwords() {}
    public static String check(String p) {
        if (p == null || p.length() < 10) return "Password must be at least 10 characters.";
        boolean up = false, lo = false, di = false;
        for (char c : p.toCharArray()) {
            if (Character.isUpperCase(c)) up = true;
            else if (Character.isLowerCase(c)) lo = true;
            else if (Character.isDigit(c)) di = true;
        }
        return (up && lo && di) ? null : "Password must include an uppercase letter, a lowercase letter and a number.";
    }
}
