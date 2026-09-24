package com.langnguyen.kltnweb.repository;

import com.langnguyen.kltnweb.entity.OrderTracking;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface OrderTrackingRepository extends MongoRepository<OrderTracking, String> {
    List<OrderTracking> findByOrderId(String orderId);
    List<OrderTracking> findByOrderIdOrderByCreatedAtDesc(String orderId);
}
