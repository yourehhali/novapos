package com.RoxPos.modules.catalog.dto;

import java.math.BigDecimal;

public record ProductResponse(
    String id,
    String name,
    String categoryId,
    BigDecimal price,
    String currency,
    String sku,
    boolean available
) {}
