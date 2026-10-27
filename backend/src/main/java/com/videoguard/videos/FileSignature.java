package com.videoguard.videos;

import java.util.Set;

/** Container signature checks, independent of the client-supplied MIME type or extension. */
public final class FileSignature {
    private FileSignature() {}
    public static final Set<String> EXTENSIONS = Set.of("mp4", "mov", "avi", "mkv", "webm");

    public static boolean matches(String ext, byte[] h) {
        if (h == null || h.length < 12) return false;
        return switch (ext) {
            case "mp4", "mov" -> h[4] == 'f' && h[5] == 't' && h[6] == 'y' && h[7] == 'p'
                    || (ext.equals("mov") && (str(h, 4, "moov") || str(h, 4, "mdat") || str(h, 4, "wide") || str(h, 4, "free")));
            case "avi" -> str(h, 0, "RIFF") && str(h, 8, "AVI ");
            case "mkv", "webm" -> (h[0] & 0xFF) == 0x1A && (h[1] & 0xFF) == 0x45 && (h[2] & 0xFF) == 0xDF && (h[3] & 0xFF) == 0xA3;
            default -> false;
        };
    }

    private static boolean str(byte[] h, int off, String s) {
        for (int i = 0; i < s.length(); i++) if (h[off + i] != (byte) s.charAt(i)) return false;
        return true;
    }
}
