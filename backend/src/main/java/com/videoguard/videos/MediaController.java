package com.videoguard.videos;

import com.videoguard.common.ApiException;
import com.videoguard.common.ApiResponse;
import com.videoguard.config.AppProperties;
import com.videoguard.events.Event;
import com.videoguard.events.EventRepository;
import com.videoguard.security.AuthUser;
import com.videoguard.security.CurrentUser;
import com.videoguard.security.JwtService;
import com.videoguard.storage.StorageService;
import io.jsonwebtoken.Claims;
import jakarta.validation.constraints.NotBlank;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.io.FilterInputStream;
import java.io.InputStream;
import java.nio.channels.Channels;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.List;
import java.util.Map;

/**
 * Browsers cannot attach Authorization headers to <video>/<img>. The client first asks (authenticated) for a token that is
 * scoped to ONE resource and expires in minutes; the media route validates that token. No public URLs exist.
 */
@RestController
@RequestMapping("/api/v1")
public class MediaController {
    public record TokenRequest(@NotBlank String kind, @NotBlank String id) {}
    private static final long CHUNK = 4L * 1024 * 1024;

    private final JwtService jwt; private final AccessService access; private final StorageService storage;
    private final VideoRepository videos; private final EventRepository events; private final AppProperties props;

    public MediaController(JwtService jwt, AccessService access, StorageService storage, VideoRepository videos, EventRepository events, AppProperties props) {
        this.jwt = jwt; this.access = access; this.storage = storage; this.videos = videos; this.events = events; this.props = props;
    }

    @PostMapping("/media-tokens")
    public ApiResponse<Map<String, Object>> token(@RequestBody @jakarta.validation.Valid TokenRequest r) {
        AuthUser u = CurrentUser.require();
        switch (r.kind()) {
            case "video", "thumb", "frame" -> access.video(u, r.id());
            case "evidence" -> {
                Event e = events.findById(r.id()).orElseThrow(ApiException::notFound);
                access.video(u, e.videoId);
            }
            default -> throw ApiException.invalid("Unknown media kind.");
        }
        String tok = jwt.issueMedia(u.id(), r.kind() + ":" + r.id());
        return ApiResponse.ok(Map.of("path", "/media/" + r.kind() + "/" + r.id(), "token", tok, "expiresInSeconds", props.mediaTokenTtlSeconds()));
    }

    @GetMapping("/media/{kind}/{id}")
    public ResponseEntity<?> serve(@PathVariable String kind, @PathVariable String id, @RequestParam("t") String token,
                                   @RequestParam(value = "i", defaultValue = "0") int index,
                                   @RequestHeader(value = HttpHeaders.RANGE, required = false) String range) throws IOException {
        Claims c;
        try { c = jwt.parse(token); } catch (RuntimeException e) { throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH_TOKEN_EXPIRED", "Media link expired."); }
        if (!"media".equals(c.get("scope")) || !(kind + ":" + id).equals(c.get("res"))) throw ApiException.forbidden();

        Path file; MediaType type;
        switch (kind) {
            case "video" -> { Video v = videos.findByIdAndDeletedAtIsNull(id).orElseThrow(ApiException::notFound); file = storage.video(v.storageKey); type = MediaType.parseMediaType(v.mimeType); }
            case "thumb" -> { Video v = videos.findByIdAndDeletedAtIsNull(id).orElseThrow(ApiException::notFound); file = storage.video(v.thumbnailKey); type = MediaType.IMAGE_JPEG; }
            case "frame" -> { Video v = videos.findByIdAndDeletedAtIsNull(id).orElseThrow(ApiException::notFound);
                if (index < 0 || index >= v.frameKeys.size()) throw ApiException.notFound();
                file = storage.video(v.frameKeys.get(index)); type = MediaType.IMAGE_JPEG; }
            case "evidence" -> { Event e = events.findById(id).orElseThrow(ApiException::notFound); file = storage.evidence(e.evidenceStorageKey); type = MediaType.IMAGE_JPEG; }
            default -> throw ApiException.notFound();
        }
        if (!Files.isRegularFile(file)) throw ApiException.notFound();
        Resource res = new FileSystemResource(file);
        long len = res.contentLength();
        HttpHeaders h = new HttpHeaders();
        h.setCacheControl(CacheControl.noStore());
        h.set(HttpHeaders.ACCEPT_RANGES, "bytes");
        h.set("X-Content-Type-Options", "nosniff");
        if (range == null || !"video".equals(kind)) return ResponseEntity.ok().headers(h).contentType(type).contentLength(len).body(res);
        List<HttpRange> ranges;
        try { ranges = HttpRange.parseRanges(range); } catch (IllegalArgumentException e) { return rangeNotSatisfiable(len); }
        if (ranges.isEmpty() || len == 0) return rangeNotSatisfiable(len);
        HttpRange requested = ranges.get(0);
        long start = requested.getRangeStart(len);
        long end = Math.min(requested.getRangeEnd(len), len - 1);
        if (start >= len || end < start) return rangeNotSatisfiable(len);

        long count = Math.min(end - start + 1, CHUNK);
        end = start + count - 1;
        var channel = Files.newByteChannel(file, StandardOpenOption.READ);
        channel.position(start);
        h.set(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + len);
        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT).headers(h).contentType(type).contentLength(count)
                .body(new InputStreamResource(limit(Channels.newInputStream(channel), count)));
    }

    private static InputStream limit(InputStream input, long length) {
        return new FilterInputStream(input) {
            private long remaining = length;

            @Override
            public int read() throws IOException {
                if (remaining == 0) return -1;
                int value = super.read();
                if (value != -1) remaining--;
                return value;
            }

            @Override
            public int read(byte[] bytes, int offset, int count) throws IOException {
                if (remaining == 0) return -1;
                int read = super.read(bytes, offset, (int) Math.min(count, remaining));
                if (read > 0) remaining -= read;
                return read;
            }
        };
    }

    private static ResponseEntity<Void> rangeNotSatisfiable(long length) {
        return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                .header(HttpHeaders.CONTENT_RANGE, "bytes */" + length).build();
    }
}
