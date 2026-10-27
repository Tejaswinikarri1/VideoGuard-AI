package com.videoguard.zones;

import com.videoguard.common.ApiResponse;
import com.videoguard.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/videos/{videoId}/zones")
public class ZoneController {
    private final ZoneService svc;
    public ZoneController(ZoneService svc) { this.svc = svc; }

    @GetMapping public ApiResponse<List<Zone>> list(@PathVariable String videoId) { return ApiResponse.ok(svc.list(CurrentUser.require(), videoId)); }

    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Zone> create(@PathVariable String videoId, @Valid @RequestBody ZoneService.ZoneRequest r) {
        return ApiResponse.ok(svc.create(CurrentUser.require(), videoId, r));
    }

    @PutMapping("/{zoneId}")
    public ApiResponse<Zone> update(@PathVariable String videoId, @PathVariable String zoneId, @Valid @RequestBody ZoneService.ZoneRequest r) {
        return ApiResponse.ok(svc.update(CurrentUser.require(), videoId, zoneId, r));
    }

    @DeleteMapping("/{zoneId}")
    public ApiResponse<Void> delete(@PathVariable String videoId, @PathVariable String zoneId) {
        svc.delete(CurrentUser.require(), videoId, zoneId);
        return new ApiResponse<>(null, null, org.slf4j.MDC.get("requestId"));
    }
}
