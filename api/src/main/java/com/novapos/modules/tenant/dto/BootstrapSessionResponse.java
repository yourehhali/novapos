package com.novapos.modules.tenant.dto;

import java.util.List;

public record BootstrapSessionResponse(
    String tenantId,
    String businessName,
    String branchId,
    String branchName,
    String timezone,
    String deviceCode,
    String deviceType,
    String lastSyncAt,
    List<String> enabledFeatures
) {}
