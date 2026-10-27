package com.videoguard.videos;

import com.videoguard.common.ApiResponse;
import com.videoguard.common.PageResult;
import com.videoguard.security.CurrentUser;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/videos")
@Validated
public class VideoController {
    public record UpdateRequest(@Size(max = 1000) String description, @Size(max = 120) String location) {}
    private final VideoService svc;

    public VideoController(VideoService svc) { this.svc = svc; }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE) @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<VideoDto> upload(@RequestPart("file") MultipartFile file, @RequestParam(value = "description", required = false) String description,
                                        @RequestParam(value = "location", required = false) String location) {
        return ApiResponse.ok(svc.upload(CurrentUser.require(), file, description, location));
    }

    @GetMapping
    public ApiResponse<PageResult<VideoDto>> list(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                                  @RequestParam(required = false) String sort, @RequestParam(defaultValue = "0") int page,
                                                  @RequestParam(defaultValue = "24") int size) {
        return ApiResponse.ok(svc.list(CurrentUser.require(), q, status, sort, page, size));
    }

    @GetMapping("/{id}")
    public ApiResponse<VideoDto> get(@PathVariable String id) { return ApiResponse.ok(svc.get(CurrentUser.require(), id)); }

    @PatchMapping("/{id}")
    public ApiResponse<VideoDto> patch(@PathVariable String id, @RequestBody @jakarta.validation.Valid UpdateRequest r) {
        return ApiResponse.ok(svc.updateDetails(CurrentUser.require(), id, r.description(), r.location()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        svc.delete(CurrentUser.require(), id);
        return new ApiResponse<>(null, null, org.slf4j.MDC.get("requestId"));
    }
}
