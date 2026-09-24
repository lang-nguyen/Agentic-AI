package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.domain.dto.ProductSummaryDTO;
import com.langnguyen.kltnweb.entity.Product;
import com.langnguyen.kltnweb.service.ProductService;
import com.langnguyen.kltnweb.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@Slf4j
public class ProductController {

    private final ProductService productService;
    private final ProductRepository productRepository;

    @GetMapping()
    public ResponseEntity<?> getProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String priceRange) {
        log.info("Anonymous request to fetch products - page: {}, size: {}, keyword: {}, priceRange: {}", page, size, keyword, priceRange);
        Page<ProductSummaryDTO> products = productService.getProducts(page, size, keyword, priceRange);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/{productId}")
    public ResponseEntity<?> getProductById(@PathVariable String productId) {
        log.info("Anonymous request to fetch product details - id: {}", productId);
        Product product = productRepository.findById(productId).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(product);
    }
}
