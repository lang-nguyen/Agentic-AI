package com.langnguyen.kltnweb.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import lombok.*;

import java.time.LocalDateTime;

@Document(collection = "order_trackings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderTracking {
    @Id
    private String id;

    @Field("created_at")
    private LocalDateTime createdAt;

    @Field("updated_at")
    private LocalDateTime updatedAt;

    @Field("order_id")
    private String orderId;

    private TrackingEvent event;
    private String message;

    public enum TrackingEvent {
        ORDER_CREATED("Order created successfully."),
        ORDER_CONFIRMED("Order confirmed and ready for shipment."),
        ORDER_DELIVERED("Order delivered successfully."),
        RETURN_REQUEST_CREATED("Return request submitted."),
        RETURN_APPROVED("Return request approved."),
        RETURN_REJECTED("Return request rejected.");

        private final String defaultMessage;

        TrackingEvent(String defaultMessage) {
            this.defaultMessage = defaultMessage;
        }

        public String getDefaultMessage() {
            return defaultMessage;
        }
    }
}
