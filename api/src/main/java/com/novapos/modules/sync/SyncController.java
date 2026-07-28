package com.novapos.modules.sync;

import com.novapos.modules.sync.dto.SyncBatchRequest;
import com.novapos.modules.sync.dto.SyncBatchResponse;
import com.novapos.modules.sync.dto.SyncStatusResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/sync")
public class SyncController {

    private final SyncService syncService;

    public SyncController(SyncService syncService) {
        this.syncService = syncService;
    }

    @PostMapping("/events")
    public SyncBatchResponse events(@Valid @RequestBody SyncBatchRequest request) {
        return syncService.ingest(request);
    }

    @GetMapping("/status")
    public SyncStatusResponse status(
        @RequestParam String branchId,
        @RequestParam String deviceId
    ) {
        return syncService.status(branchId, deviceId);
    }

    @GetMapping("/bootstrap")
    public SyncStatusResponse bootstrap(
        @RequestParam String branchId,
        @RequestParam String deviceId
    ) {
        return syncService.status(branchId, deviceId);
    }
}
