package com.videoguard.videos;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.videoguard.common.ApiException;
import com.videoguard.config.AppProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.TimeUnit;

/** FFprobe/FFmpeg wrappers. Arguments are passed as a list (no shell), file paths are server-generated. */
@Component
public class MediaTools {
    public record Probe(double durationSeconds, int width, int height, double frameRate, String codec, String container) {}

    private final AppProperties props;
    private final ObjectMapper mapper = new ObjectMapper();

    public MediaTools(AppProperties props) { this.props = props; }

    public Probe probe(Path file) {
        String out = run(List.of(props.ffprobeBin(), "-v", "error", "-print_format", "json", "-show_format", "-show_streams", file.toString()), 30, true);
        try {
            JsonNode root = mapper.readTree(out);
            JsonNode v = null;
            for (JsonNode s : root.path("streams")) if ("video".equals(s.path("codec_type").asText())) { v = s; break; }
            if (v == null) throw fail("No decodable video stream found.");
            double dur = v.hasNonNull("duration") ? v.get("duration").asDouble() : root.path("format").path("duration").asDouble(0);
            String[] fr = v.path("avg_frame_rate").asText("0/1").split("/");
            double fps = fr.length == 2 && Double.parseDouble(fr[1]) != 0 ? Double.parseDouble(fr[0]) / Double.parseDouble(fr[1]) : 0;
            if (dur <= 0 || v.path("width").asInt() <= 0) throw fail("Video has no usable duration or dimensions.");
            return new Probe(dur, v.get("width").asInt(), v.get("height").asInt(), Math.round(fps * 1000) / 1000.0,
                    v.path("codec_name").asText(null), root.path("format").path("format_name").asText(null));
        } catch (IOException | NumberFormatException e) {
            throw fail("Metadata could not be read.");
        }
    }

    /** Writes a scaled JPEG of the frame at the given time. Returns false when ffmpeg could not produce it. */
    public boolean frame(Path video, double seconds, int width, Path out) {
        try {
            run(List.of(props.ffmpegBin(), "-v", "error", "-y", "-ss", String.format(java.util.Locale.ROOT, "%.3f", seconds), "-i", video.toString(),
                    "-frames:v", "1", "-vf", "scale=" + width + ":-2", "-q:v", "4", out.toString()), 30, false);
            return java.nio.file.Files.exists(out);
        } catch (ApiException e) { return false; }
    }

    private String run(List<String> cmd, int timeoutSec, boolean captureOut) {
        try {
            Process p = new ProcessBuilder(cmd).redirectErrorStream(false)
                    .redirectError(ProcessBuilder.Redirect.DISCARD).start();
            String out = captureOut ? new String(p.getInputStream().readAllBytes()) : "";
            if (!captureOut) p.getInputStream().transferTo(java.io.OutputStream.nullOutputStream());
            if (!p.waitFor(timeoutSec, TimeUnit.SECONDS)) { p.destroyForcibly(); throw fail("Media tool timed out."); }
            if (p.exitValue() != 0) throw fail("File could not be decoded.");
            return out;
        } catch (IOException e) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "VIDEO_METADATA_FAILED", "FFmpeg/FFprobe is not available on the server.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw fail("Interrupted.");
        }
    }

    private static ApiException fail(String msg) { return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VIDEO_METADATA_FAILED", msg); }
}
