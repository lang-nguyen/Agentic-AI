package com.langnguyen.kltnweb.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.*;
import java.util.List;
import java.util.Map;

@Document(collection = "orders")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {
    @Id
    @Field("order_id")
    private String orderId;

    @Field("user_id")
    private String userId;

    private Address address;
    private List<OrderItem> items;
    private List<Fulfillment> fulfillments;
    private OrderStatus status;

    @Field("payment_history")
    private List<PaymentRecord> paymentHistory;

    @Field("created_at")
    private java.time.LocalDateTime createdAt;

    @Field("updated_at")
    private java.time.LocalDateTime updatedAt;

    public enum OrderStatus {
        processed,
        pending,
        delivered,
        return_requested,
        exchange_requested,
        cancelled
    }

    @Transient
    public double getTotal() {
        if (items == null)
            return 0;
        return items.stream()
                .mapToDouble(item -> item.getPrice() * Math.max(1, item.getQuantity()))
                .sum();
    }

    @Transient
    public int getItemCount() {
        return items != null ? items.stream().mapToInt(item -> Math.max(1, item.getQuantity())).sum() : 0;
    }

    @Data
    public static class OrderItem {
        private String name;
        @Field("product_id")
        private String productId;
        @Field("item_id")
        private String itemId;
        private double price;
        private Map<String, String> options;
        @Field("image_url")
        private String imageUrl;
        private int quantity = 1;
    }

    @Data
    public static class Fulfillment {
        @Field("tracking_id")
        private List<String> trackingId;
        @Field("item_ids")
        private List<String> itemIds;
    }

    @Data
    public static class PaymentRecord {
        @Field("transaction_type")
        private String transactionType;
        private double amount;
        @Field("payment_method_id")
        private String paymentMethodId;
    }
}
