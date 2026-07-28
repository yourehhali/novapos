package com.novapos.modules.printing;

import com.novapos.modules.printing.dto.PrinterConfigResponse;
import com.novapos.modules.shared.SampleDataService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SampleDataService sampleDataService;

    public SettingsController(SampleDataService sampleDataService) {
        this.sampleDataService = sampleDataService;
    }

    @GetMapping("/printers")
    public List<PrinterConfigResponse> printers() {
        return sampleDataService.getPrinters().stream()
            .map(printer -> new PrinterConfigResponse(
                printer.id(),
                printer.name(),
                printer.target(),
                printer.protocol(),
                printer.queueName(),
                printer.paperWidthMm(),
                printer.charactersPerLine(),
                printer.printMode(),
                printer.silent(),
                printer.systemPrinterName()
            ))
            .toList();
    }
}
