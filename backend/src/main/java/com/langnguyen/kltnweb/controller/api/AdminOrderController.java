package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.Order;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/orders")
@RequiredArgsConstructor
public class AdminOrderController {

    private final AuthService authService;
    private final OrderService orderService;

    @GetMapping()
    public ResponseEntity<?> getAllOrders() {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        List<Order> orders = orderService.getAllOrders();
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<?> getOrderById(@PathVariable String orderId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        Order order = orderService.getOrderById(orderId).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(order);
    }

    @PostMapping()
    public ResponseEntity<?> createOrder(@RequestBody Order order) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        Order created = orderService.saveOrder(order);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{orderId}")
    public ResponseEntity<?> updateOrder(@PathVariable String orderId, @RequestBody Order order) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        Order existing = orderService.getOrderById(orderId).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        order.setOrderId(orderId);
        Order updated = orderService.saveOrder(order);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{orderId}/status")
    public ResponseEntity<?> updateOrderStatus(@PathVariable String orderId, @RequestBody Map<String, String> body) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        String status = body.get("status");
        if (status == null) {
            return ResponseEntity.badRequest().body("Status field is required");
        }
        Order updated = orderService.updateOrderStatus(orderId, status).orElse(null);
        if (updated == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{orderId}")
    public ResponseEntity<?> deleteOrder(@PathVariable String orderId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        boolean deleted = orderService.deleteOrder(orderId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok("Order deleted successfully");
    }
}
