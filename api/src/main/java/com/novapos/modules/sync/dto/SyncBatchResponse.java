package com.novapos.modules.sync.dto;

import java.util.List;

public record SyncBatchResponse(
    List<String> acceptedEventUuids,
    List<String> duplicateEventUuids,
    List<String> conflictedEventUuids,
    String serverCursor
) {}
