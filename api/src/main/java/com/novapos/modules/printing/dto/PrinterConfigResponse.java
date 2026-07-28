package com.novapos.modules.printing.dto;

public record PrinterConfigResponse(
    String id,
    String name,
    String target,
    String protocol,
    String queueName,
    Integer paperWidthMm,
    Integer charactersPerLine,
    String printMode,
    Boolean silent,
    String systemPrinterName
) {}
