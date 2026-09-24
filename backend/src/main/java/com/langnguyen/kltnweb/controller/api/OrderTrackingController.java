package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.OrderTracking;
import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.repository.OrderTrackingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/order-trackings")
@RequiredArgsConstructor
public class OrderTrackingController {

    private final AuthService authService;
    private final OrderTrackingRepository orderTrackingRepository;

    @GetMapping("/{orderId}")
    public ResponseEntity<?> getOrderTracking(@PathVariable String orderId) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        List<OrderTracking> trackings = orderTrackingRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
        return ResponseEntity.ok(trackings);
    }
}
