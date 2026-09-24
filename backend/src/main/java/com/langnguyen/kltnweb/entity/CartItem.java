package com.langnguyen.kltnweb.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CartItem {
    private String productId;
    private String variantId;
    private String name;
    private String imageUrl;
    private double price;
    private int quantity;
    private Map<String, String> options;
}
