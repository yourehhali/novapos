package com.novapos.modules.identity.dto;

import java.util.List;

public record AuthSessionResponse(
    String accessToken,
    String refreshToken,
    UserSession user
) {
    public record UserSession(
        String id,
        String displayName,
        String tenantId,
        String businessName,
        List<String> roles,
        List<String> permissions,
        List<BranchAssignment> branchAssignments
    ) {}

    public record BranchAssignment(
        String branchId,
        String branchName,
        String defaultDeviceType
    ) {}
}
