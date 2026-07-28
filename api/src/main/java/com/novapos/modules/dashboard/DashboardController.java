package com.novapos.modules.dashboard;

import com.novapos.modules.dashboard.dto.DashboardSummaryResponse;
import com.novapos.modules.shared.SampleDataService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {

    private final SampleDataService sampleDataService;

    public DashboardController(SampleDataService sampleDataService) {
        this.sampleDataService = sampleDataService;
    }

    @GetMapping("/summary")
    public DashboardSummaryResponse summary(@RequestParam String branchId) {
        var dashboard = sampleDataService.getDashboard(branchId);

        return new DashboardSummaryResponse(
            dashboard.businessName(),
            dashboard.branchId(),
            dashboard.activeOrders(),
            dashboard.revenueToday(),
            dashboard.queueDepth(),
            dashboard.lastSuccessfulSyncAt(),
            dashboard.operationalNotes()
        );
    }
}
