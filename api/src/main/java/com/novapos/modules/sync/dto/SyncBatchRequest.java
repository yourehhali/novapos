package com.novapos.modules.sync.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record SyncBatchRequest(
    @NotBlank String branchId,
    @NotBlank String deviceId,
    String lastKnownServerCursor,
    @Valid @NotEmpty List<SyncEventEnvelope> events
) {}
