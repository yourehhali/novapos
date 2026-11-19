package com.RoxPos.common.security;

import java.util.List;

public record SessionPrincipal(
    String userId,
    String displayName,
    String tenantId,
    List<String> roles,
    List<String> permissions
) {}
