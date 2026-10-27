package com.videoguard.dashboard;

import com.videoguard.common.ApiResponse;
import com.videoguard.security.CurrentUser;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {
    private final DashboardService svc;
    public DashboardController(DashboardService svc) { this.svc = svc; }

    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary(@RequestParam(defaultValue = "30") int days) { return ApiResponse.ok(svc.summary(CurrentUser.require(), days)); }
}
