package com.videoguard.logic;

import com.videoguard.analysis.AiResultValidator;
import com.videoguard.analysis.AnalysisService;
import com.videoguard.events.Event;
import com.videoguard.users.Passwords;
import com.videoguard.videos.FileSignature;
import com.videoguard.zones.PolygonValidator;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class PureLogicTest {
    private static List<Double> p(double x, double y) { return List.of(x, y); }

    @Test void validPolygonAccepted() {
        assertTrue(PolygonValidator.validate(List.of(p(.2, .2), p(.8, .2), p(.8, .8), p(.2, .8))).isEmpty());
    }

    @Test void invalidPolygonsRejected() {
        assertFalse(PolygonValidator.validate(List.of(p(0, 0), p(1, 1))).isEmpty());
        assertFalse(PolygonValidator.validate(List.of(p(.1, .1), p(1.5, .1), p(.5, .5))).isEmpty());
        assertFalse(PolygonValidator.validate(List.of(p(.1, .1), p(.9, .9), p(.1, .9), p(.9, .1))).isEmpty()); // bow-tie
        assertFalse(PolygonValidator.validate(List.of(p(.1, .1), p(.2, .2), p(.3, .3))).isEmpty());            // collinear
    }

    @Test void passwordPolicy() {
        assertNotNull(Passwords.check("Short1a"));
        assertNotNull(Passwords.check("alllowercase1"));
        assertNull(Passwords.check("ValidPassw0rd"));
    }

    @Test void signatureChecksContentNotName() {
        byte[] text = "this is not a video".getBytes();
        assertFalse(FileSignature.matches("mp4", text));
        byte[] mp4 = {0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm'};
        assertTrue(FileSignature.matches("mp4", mp4));
        assertFalse(FileSignature.matches("avi", mp4));
        byte[] mkv = {0x1A, 0x45, (byte) 0xDF, (byte) 0xA3, 0, 0, 0, 0, 0, 0, 0, 0};
        assertTrue(FileSignature.matches("webm", mkv));
    }

    @Test void csvCellsNeutraliseFormulas() {
        assertEquals("\"'=SUM(A1)\"", AnalysisService.cell("=SUM(A1)"));
        assertEquals("\"a\"\"b\"", AnalysisService.cell("a\"b"));
    }

    private static Map<String, Object> goodEvent() {
        return new java.util.HashMap<>(Map.of("eventType", "PERSON_LOITERING", "severity", "LOW", "startTimeSeconds", 4.0, "endTimeSeconds", 14.0,
                "confidence", 0.8, "description", "Tracked person remained within a small area.", "trackId", 3, "evidenceKey", "a1/e.jpg",
                "reviewStatus", "CONFIRMED")); // hostile payload: must be ignored
    }

    @Test void aiEventsAlwaysStartPending() {
        Optional<Event> e = AiResultValidator.event("a1", "v1", 60, "1.0.0", goodEvent());
        assertTrue(e.isPresent());
        assertEquals("PENDING", e.get().reviewStatus);
        assertEquals("AVAILABLE", e.get().evidenceStatus);
    }

    @Test void aiEventsValidatedAndDeterministicIds() {
        Map<String, Object> bad = goodEvent(); bad.put("confidence", 1.7);
        assertTrue(AiResultValidator.event("a1", "v1", 60, "1.0.0", bad).isEmpty());
        Map<String, Object> past = goodEvent(); past.put("endTimeSeconds", 500.0);
        assertTrue(AiResultValidator.event("a1", "v1", 60, "1.0.0", past).isEmpty());
        Map<String, Object> traversal = goodEvent(); traversal.put("evidenceKey", "a1/../../etc/passwd");
        assertEquals("FAILED", AiResultValidator.event("a1", "v1", 60, "1.0.0", traversal).orElseThrow().evidenceStatus);
        assertEquals(AiResultValidator.event("a1", "v1", 60, "1.0.0", goodEvent()).orElseThrow().id,
                AiResultValidator.event("a1", "v1", 60, "1.0.0", goodEvent()).orElseThrow().id);
    }
}
