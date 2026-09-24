package com.langnguyen.kltnweb.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.*;
import java.util.Map;
import java.util.List;

@Document(collection = "products")
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Product {
    @Id
    @Field("product_id")
    private String productId;
    
    private String name;
    
    @Field("display_name")
    private String displayName;
    
    @Field("main_image")
    private String mainImage;

    @Field("option_images")
    private List<ProductImage> optionImages;
    
    private Map<String, Variant> variants;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ProductImage {
        private Map<String, String> options;
        private List<String> images;
    }

    @Data
    public static class Variant {
        @Field("item_id")
        private String itemId;
        private Map<String, String> options;
        private boolean available;
        private double price;
    }
}
