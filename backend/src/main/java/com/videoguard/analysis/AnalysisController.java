package com.videoguard.analysis;

import com.videoguard.common.ApiResponse;
import com.videoguard.common.PageResult;
import com.videoguard.security.CurrentUser;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/v1")
public class AnalysisController {
    private final AnalysisService svc;
    public AnalysisController(AnalysisService svc) { this.svc = svc; }

    @PostMapping("/videos/{videoId}/analyses") @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<AnalysisDto> create(@PathVariable String videoId, @RequestHeader("Idempotency-Key") String key) {
        return ApiResponse.ok(svc.create(CurrentUser.require(), videoId, key));
    }

    @GetMapping("/videos/{videoId}/analyses")
    public ApiResponse<List<AnalysisDto>> forVideo(@PathVariable String videoId) { return ApiResponse.ok(svc.forVideo(CurrentUser.require(), videoId)); }

    @GetMapping("/analyses")
    public ApiResponse<PageResult<AnalysisDto>> list(@RequestParam(required = false) String status, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        return ApiResponse.ok(svc.list(CurrentUser.require(), status, page, size));
    }

    @GetMapping("/analyses/{id}")
    public ApiResponse<AnalysisDto> get(@PathVariable String id) { return ApiResponse.ok(svc.get(CurrentUser.require(), id)); }

    @GetMapping("/analyses/{id}/logs")
    public ApiResponse<List<String>> logs(@PathVariable String id) { return ApiResponse.ok(svc.logs(CurrentUser.require(), id)); }

    @PostMapping("/analyses/{id}/cancel")
    public ApiResponse<AnalysisDto> cancel(@PathVariable String id) { return ApiResponse.ok(svc.cancel(CurrentUser.require(), id)); }

    @GetMapping("/analyses/{id}/export")
    public ResponseEntity<byte[]> export(@PathVariable String id) {
        byte[] body = svc.exportCsv(CurrentUser.require(), id).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"analysis-" + id + ".csv\"")
                .header(HttpHeaders.CONTENT_TYPE, "text/csv; charset=utf-8").body(body);
    }
}
