package com.novapos.modules.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;

public record DashboardSummaryResponse(
    String businessName,
    String branchId,
    int activeOrders,
    BigDecimal revenueToday,
    int localQueueDepth,
    String lastSuccessfulSyncAt,
    List<String> operationalNotes
) {}
