package com.videoguard.events;

import com.videoguard.common.ApiResponse;
import com.videoguard.common.PageResult;
import com.videoguard.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class EventController {
    private final EventService svc;
    public EventController(EventService svc) { this.svc = svc; }

    @GetMapping("/analyses/{analysisId}/events")
    public ApiResponse<List<EventDto>> forAnalysis(@PathVariable String analysisId, @RequestParam(required = false) String type,
                                                   @RequestParam(required = false) String severity, @RequestParam(required = false) String status,
                                                   @RequestParam(required = false) String q) {
        return ApiResponse.ok(svc.forAnalysis(CurrentUser.require(), analysisId, type, severity, status, q));
    }

    @GetMapping("/events")
    public ApiResponse<PageResult<EventDto>> search(@RequestParam(required = false) String type, @RequestParam(required = false) String severity,
                                                    @RequestParam(required = false) String status, @RequestParam(required = false) String q,
                                                    @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "8") int size) {
        return ApiResponse.ok(svc.search(CurrentUser.require(), type, severity, status, q, page, size));
    }

    @GetMapping("/events/pending-count")
    public ApiResponse<Long> pendingCount() { return ApiResponse.ok(svc.pendingCount(CurrentUser.require())); }

    @GetMapping("/events/{id}")
    public ApiResponse<EventDto> get(@PathVariable String id) { return ApiResponse.ok(svc.get(CurrentUser.require(), id)); }

    @PostMapping("/events/{id}/reviews") @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EventDto> review(@PathVariable String id, @Valid @RequestBody EventService.ReviewRequest r) {
        return ApiResponse.ok(svc.review(CurrentUser.require(), id, r));
    }

    @GetMapping("/events/{id}/reviews")
    public ApiResponse<List<Review>> history(@PathVariable String id) { return ApiResponse.ok(svc.history(CurrentUser.require(), id)); }
}
