package com.videoguard.storage;

import com.videoguard.common.ApiException;
import com.videoguard.config.AppProperties;
import jakarta.annotation.PostConstruct;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

/** Files live outside any web root and are addressed only by generated keys, never by user-supplied names. */
@Service
public class StorageService {
    private final Path videoRoot;
    private final Path evidenceRoot;

    public StorageService(AppProperties p) {
        this.videoRoot = Path.of(p.videoRoot()).toAbsolutePath().normalize();
        this.evidenceRoot = Path.of(p.evidenceRoot()).toAbsolutePath().normalize();
    }

    @PostConstruct
    void init() throws IOException { Files.createDirectories(videoRoot); Files.createDirectories(evidenceRoot); }

    public Path video(String key) { return resolve(videoRoot, key); }
    public Path evidence(String key) { return resolve(evidenceRoot, key); }
    public Path videoRoot() { return videoRoot; }

    static Path resolve(Path root, String key) {
        if (key == null || key.isBlank() || key.contains("\\")) throw ApiException.notFound();
        Path p = root.resolve(key).normalize();
        if (!p.startsWith(root)) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Invalid storage key.");
        return p;
    }

    public void deleteQuietly(Path p) {
        try { if (p != null) Files.deleteIfExists(p); } catch (IOException ignored) { /* best effort */ }
    }

    public void deleteTreeQuietly(Path dir) {
        try {
            if (dir == null || !Files.exists(dir)) return;
            try (var s = Files.walk(dir)) { s.sorted(java.util.Comparator.reverseOrder()).forEach(this::deleteQuietly); }
        } catch (IOException ignored) { /* best effort */ }
    }
}
