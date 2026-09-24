package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.domain.dto.ProductSummaryDTO;
import com.langnguyen.kltnweb.entity.Product;
import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.ProductService;
import com.langnguyen.kltnweb.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import com.langnguyen.kltnweb.service.CloudinaryService;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/products")
@RequiredArgsConstructor
@Slf4j
public class AdminProductController {

    private final AuthService authService;
    private final ProductService productService;
    private final ProductRepository productRepository;
    private final CloudinaryService cloudinaryService;

    @GetMapping()
    public ResponseEntity<?> getProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String priceRange) {
        
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        Page<ProductSummaryDTO> products = productService.getProducts(page, size, keyword, priceRange);
        return ResponseEntity.ok(products);
    }

    @GetMapping("/{productId}")
    public ResponseEntity<?> getProductById(@PathVariable String productId) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        Product product = productRepository.findById(productId).orElse(null);
        if (product == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(product);
    }

    @PostMapping()
    public ResponseEntity<?> createProduct(@RequestBody Product product) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        Product created = productService.createProduct(product);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{productId}")
    public ResponseEntity<?> updateProduct(@PathVariable String productId, @RequestBody Product product) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        Product updated = productService.updateProduct(productId, product).orElse(null);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{productId}")
    public ResponseEntity<?> deleteProduct(@PathVariable String productId) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        boolean deleted = productService.deleteProduct(productId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok("Product deleted successfully");
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        try {
            String secureUrl = cloudinaryService.uploadImage(file);
            return ResponseEntity.ok(Map.of("url", secureUrl));
        } catch (Exception e) {
            log.error("Failed to upload image to Cloudinary", e);
            return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
        }
    }
}
