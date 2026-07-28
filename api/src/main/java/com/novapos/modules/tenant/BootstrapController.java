package com.novapos.modules.tenant;

import com.novapos.modules.shared.SampleDataService;
import com.novapos.modules.tenant.dto.BootstrapSessionResponse;
import java.time.Instant;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/bootstrap")
public class BootstrapController {

    private final SampleDataService sampleDataService;

    public BootstrapController(SampleDataService sampleDataService) {
        this.sampleDataService = sampleDataService;
    }

    @GetMapping("/session")
    public BootstrapSessionResponse session(
        @RequestParam String branchId,
        @RequestParam(defaultValue = "POS_TERMINAL") String deviceType,
        @RequestParam(required = false) String deviceCode
    ) {
        var branch = sampleDataService.findBranch(branchId)
            .orElseThrow(() -> new IllegalArgumentException("Unknown branch " + branchId));

        return new BootstrapSessionResponse(
            "tenant-atlas-bites",
            "Atlas Bites Group",
            branch.id(),
            branch.name(),
            branch.timezone(),
            deviceCode == null || deviceCode.isBlank()
                ? sampleDataService.nextDeviceCode(branch.id(), deviceType)
                : deviceCode,
            deviceType,
            Instant.now().toString(),
            List.of("POS", "SYNC", "PRINTING", "DASHBOARD", "ADMIN")
        );
    }
}
