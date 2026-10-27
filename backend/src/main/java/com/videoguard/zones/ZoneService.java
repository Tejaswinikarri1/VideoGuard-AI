package com.videoguard.zones;

import com.videoguard.audit.AuditService;
import com.videoguard.common.ApiException;
import com.videoguard.common.Ids;
import com.videoguard.security.AuthUser;
import com.videoguard.videos.AccessService;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class ZoneService {
    public record ZoneRequest(@NotBlank @Size(max = 80) String name, @Size(max = 300) String description,
                              @Pattern(regexp = "^#[0-9a-fA-F]{6}$") String color, List<List<Double>> polygon, Boolean enabled) {}

    private final ZoneRepository zones; private final AccessService access; private final AuditService audit;

    public ZoneService(ZoneRepository zones, AccessService access, AuditService audit) { this.zones = zones; this.access = access; this.audit = audit; }

    public List<Zone> list(AuthUser u, String videoId) { access.video(u, videoId); return zones.findByVideoIdOrderByCreatedAtAsc(videoId); }

    public Zone create(AuthUser u, String videoId, ZoneRequest r) {
        access.ownedVideo(u, videoId);
        if (zones.findByVideoIdOrderByCreatedAtAsc(videoId).size() >= 20) throw ApiException.invalid("A video can have at most 20 zones.");
        Zone z = new Zone();
        z.id = Ids.uuid(); z.videoId = videoId; z.ownerId = u.id();
        apply(z, r);
        zones.save(z);
        audit.record(u, "UPDATE_ZONE", "Create Restricted Zone", "ZONE", z.id, true, "Created restricted zone \"" + z.name + "\" with " + z.polygon.size() + " polygon points");
        return z;
    }

    public Zone update(AuthUser u, String videoId, String zoneId, ZoneRequest r) {
        access.ownedVideo(u, videoId);
        Zone z = zones.findById(zoneId).filter(x -> x.videoId.equals(videoId)).orElseThrow(ApiException::notFound);
        apply(z, r);
        z.updatedAt = Instant.now();
        zones.save(z);
        audit.record(u, "UPDATE_ZONE", "Update Restricted Zone", "ZONE", z.id, true, "Updated restricted zone \"" + z.name + "\" with " + z.polygon.size() + " polygon points");
        return z;
    }

    public void delete(AuthUser u, String videoId, String zoneId) {
        access.ownedVideo(u, videoId);
        Zone z = zones.findById(zoneId).filter(x -> x.videoId.equals(videoId)).orElseThrow(ApiException::notFound);
        zones.delete(z);
        audit.record(u, "DELETE_ZONE", "Delete Restricted Zone", "ZONE", zoneId, true, "Deleted restricted zone \"" + z.name + "\"");
    }

    private void apply(Zone z, ZoneRequest r) {
        List<String> errs = PolygonValidator.validate(r.polygon());
        if (!errs.isEmpty()) throw ApiException.invalid("Invalid polygon: " + String.join("; ", errs));
        z.name = r.name().trim(); z.description = r.description(); z.color = r.color() == null ? "#2f8cff" : r.color();
        z.polygon = r.polygon(); z.enabled = r.enabled() == null || r.enabled();
    }
}
