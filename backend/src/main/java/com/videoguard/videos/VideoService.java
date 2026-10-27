package com.videoguard.videos;

import com.videoguard.analysis.AnalysisJob;
import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.common.PageResult;
import com.videoguard.config.AppProperties;
import com.videoguard.security.AuthUser;
import com.videoguard.storage.StorageService;
import com.videoguard.users.User;
import com.videoguard.users.UserRepository;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class VideoService {
    private final VideoRepository videos; private final MongoTemplate t; private final AccessService access;
    private final StorageService storage; private final MediaTools tools; private final AuditService audit;
    private final UserRepository users; private final AppProperties props;

    public VideoService(VideoRepository videos, MongoTemplate t, AccessService access, StorageService storage, MediaTools tools,
                        AuditService audit, UserRepository users, AppProperties props) {
        this.videos = videos; this.t = t; this.access = access; this.storage = storage; this.tools = tools;
        this.audit = audit; this.users = users; this.props = props;
    }

    private static String mimeFor(String ext) {
        return switch (ext) { case "mp4" -> "video/mp4"; case "mov" -> "video/quicktime"; case "avi" -> "video/x-msvideo";
            case "mkv" -> "video/x-matroska"; default -> "video/webm"; };
    }

    public VideoDto upload(AuthUser u, MultipartFile file, String description, String location) {
        if (file == null || file.isEmpty()) throw ApiException.invalid("No file was provided.");
        String raw = Optional.ofNullable(file.getOriginalFilename()).orElse("video");
        String name = raw.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1);
        if (name.length() > 200) name = name.substring(name.length() - 200);
        String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
        if (!FileSignature.EXTENSIONS.contains(ext))
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "VIDEO_FORMAT_UNSUPPORTED", "Unsupported format. Use MP4, MOV, AVI, MKV or WEBM.");
        try (InputStream in = file.getInputStream()) {
            if (!FileSignature.matches(ext, in.readNBytes(16)))
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VIDEO_SIGNATURE_INVALID", "The file content does not match a " + ext.toUpperCase() + " video.");
        } catch (IOException e) { throw ApiException.invalid("The file could not be read."); }

        String id = Ids.uuid();
        Path dest = storage.video(id + "." + ext);
        Path thumbDir = storage.video("thumbs/" + id);
        try {
            file.transferTo(dest);
            MediaTools.Probe p = tools.probe(dest); // proves the file is decodable and yields the real metadata
            if (p.durationSeconds() > props.maxDurationSeconds())
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VIDEO_TOO_LARGE", "Video exceeds the maximum duration of " + props.maxDurationSeconds() + " seconds.");
            Video v = new Video();
            v.id = id; v.ownerId = u.id(); v.originalFilename = name; v.storageKey = id + "." + ext; v.mimeType = mimeFor(ext);
            v.sizeBytes = Files.size(dest); v.durationSeconds = p.durationSeconds(); v.width = p.width(); v.height = p.height();
            v.frameRate = p.frameRate(); v.codec = p.codec(); v.container = p.container();
            v.description = description == null ? null : description.substring(0, Math.min(description.length(), 1000));
            v.location = location == null || location.isBlank() ? null : location.trim().substring(0, Math.min(location.trim().length(), 120));
            Files.createDirectories(thumbDir);
            Path main = thumbDir.resolve("thumb.jpg");
            if (tools.frame(dest, p.durationSeconds() * 0.1, 640, main)) v.thumbnailKey = "thumbs/" + id + "/thumb.jpg";
            for (int i = 0; i < 6; i++) {
                Path f = thumbDir.resolve("f" + i + ".jpg");
                if (tools.frame(dest, p.durationSeconds() * (i + 0.5) / 6.0, 320, f)) v.frameKeys.add("thumbs/" + id + "/f" + i + ".jpg");
            }
            v.metadataStatus = "COMPLETED";
            videos.save(v);
            audit.record(u, "UPLOAD_VIDEO", "Upload Video", "VIDEO", id, true, "Video \"" + name + "\" (" + v.sizeBytes + " bytes) uploaded");
            return toDto(v);
        } catch (ApiException e) {
            cleanup(dest, thumbDir);
            audit.record(u, "UPLOAD_VIDEO", "Upload Video", "VIDEO", id, false, e.code);
            throw e;
        } catch (IOException | RuntimeException e) {
            cleanup(dest, thumbDir);
            audit.record(u, "UPLOAD_VIDEO", "Upload Video", "VIDEO", id, false, "storage error");
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "The upload could not be stored.");
        }
    }

    private void cleanup(Path file, Path thumbDir) { storage.deleteQuietly(file); storage.deleteTreeQuietly(thumbDir); }

    public PageResult<VideoDto> list(AuthUser u, String q, String status, String sort, int page, int size) {
        size = PageResult.clampSize(size); page = Math.max(page, 0);
        Criteria c = access.accessibleVideos(u);
        List<Criteria> and = new ArrayList<>(List.of(c));
        if (q != null && !q.isBlank()) and.add(Criteria.where("originalFilename").regex(Pattern.quote(q.trim()), "i"));
        Query query = Query.query(new Criteria().andOperator(and)).with(Sort.by("oldest".equals(sort) ? Sort.Direction.ASC : Sort.Direction.DESC, "createdAt"));
        List<Video> all = t.find(query, Video.class);
        List<VideoDto> dtos = toDtos(all);
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            String want = status.toUpperCase();
            dtos = dtos.stream().filter(d -> matchesStatus(d.latestAnalysisStatus(), want)).toList();
        }
        int from = Math.min(page * size, dtos.size()), to = Math.min(from + size, dtos.size());
        return new PageResult<>(dtos.subList(from, to), dtos.size(), page, size);
    }

    private static boolean matchesStatus(String latest, String want) {
        if (latest == null) return false;
        return switch (want) { case "PROCESSING" -> latest.equals("RUNNING") || latest.equals("QUEUED"); default -> latest.equals(want); };
    }

    public VideoDto get(AuthUser u, String id) { return toDto(access.video(u, id)); }

    public VideoDto updateDetails(AuthUser u, String id, String description, String location) {
        Video v = access.ownedVideo(u, id);
        if (description != null) v.description = description.substring(0, Math.min(description.length(), 1000));
        if (location != null) v.location = location.isBlank() ? null : location.trim().substring(0, Math.min(location.trim().length(), 120));
        videos.save(v);
        audit.record(u, "UPDATE_VIDEO", "Update Video", "VIDEO", id, true, "Details updated");
        return toDto(v);
    }

    public void delete(AuthUser u, String id) {
        Video v = access.ownedVideo(u, id);
        v.deletedAt = Instant.now();
        videos.save(v);
        storage.deleteQuietly(storage.video(v.storageKey));
        storage.deleteTreeQuietly(storage.video("thumbs/" + v.id));
        audit.record(u, "DELETE_VIDEO", "Delete Video", "VIDEO", id, true, "Deleted video \"" + v.originalFilename + "\" (" + v.sizeBytes + " bytes)");
    }

    public VideoDto toDto(Video v) { return toDtos(List.of(v)).get(0); }

    private List<VideoDto> toDtos(List<Video> list) {
        if (list.isEmpty()) return List.of();
        List<String> ids = list.stream().map(v -> v.id).toList();
        Map<String, List<AnalysisJob>> jobs = t.find(Query.query(Criteria.where("videoId").in(ids)).with(Sort.by(Sort.Direction.DESC, "createdAt")), AnalysisJob.class)
                .stream().collect(Collectors.groupingBy(j -> j.videoId));
        Map<String, User> owners = new HashMap<>();
        users.findAllById(list.stream().map(v -> v.ownerId).collect(Collectors.toSet())).forEach(o -> owners.put(o.id, o));
        List<VideoDto> out = new ArrayList<>();
        for (Video v : list) {
            List<AnalysisJob> js = jobs.getOrDefault(v.id, List.of());
            User o = owners.get(v.ownerId);
            out.add(VideoDto.of(v, o == null ? null : o.displayName, o == null ? null : o.email, js.size(),
                    js.isEmpty() ? null : js.get(0).status, js.isEmpty() ? null : js.get(0).id));
        }
        return out;
    }
}
