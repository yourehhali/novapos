package com.novapos.modules.sync.dto;

public record SyncStatusResponse(
    String branchId,
    String deviceId,
    int acceptedEvents,
    int duplicateEvents,
    int pendingConflicts,
    String serverCursor
) {}
