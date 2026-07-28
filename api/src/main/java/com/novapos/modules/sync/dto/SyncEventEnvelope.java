package com.novapos.modules.sync.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record SyncEventEnvelope(
    @NotBlank String eventUuid,
    @NotBlank String tenantId,
    @NotBlank String branchId,
    @NotBlank String deviceId,
    @NotNull Long deviceSequence,
    @NotBlank String timestamp,
    @NotBlank String eventType,
    @NotBlank String aggregateType,
    @NotBlank String aggregateId,
    @NotNull Long aggregateVersion,
    @NotNull Integer schemaVersion,
    @NotBlank String status,
    String correlationId,
    String causationId,
    @NotNull Map<String, Object> payload
) {}
