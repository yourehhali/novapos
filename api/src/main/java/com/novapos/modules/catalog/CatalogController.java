package com.RoxPos.modules.catalog;

import com.RoxPos.modules.catalog.dto.CategoryResponse;
import com.RoxPos.modules.catalog.dto.ProductResponse;
import com.RoxPos.modules.shared.SampleDataService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final SampleDataService sampleDataService;

    public CatalogController(SampleDataService sampleDataService) {
        this.sampleDataService = sampleDataService;
    }

    @GetMapping("/products")
    public List<ProductResponse> products() {
        return sampleDataService.getProducts().stream()
            .map(product -> new ProductResponse(
                product.id(),
                product.name(),
                product.categoryId(),
                product.price(),
                product.currency(),
                product.sku(),
                product.available()
            ))
            .toList();
    }

    @GetMapping("/categories")
    public List<CategoryResponse> categories() {
        return sampleDataService.getCategories().stream()
            .map(category -> new CategoryResponse(
                category.id(),
                category.name(),
                category.description()
            ))
            .toList();
    }
}
