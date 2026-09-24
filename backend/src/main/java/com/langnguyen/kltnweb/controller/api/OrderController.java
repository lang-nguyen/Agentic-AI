package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.Order;
import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.OrderService;
import com.langnguyen.kltnweb.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.Comparator;
import java.util.List;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
class OrderController {

    private final OrderService orderService;

    private final AuthService authService;

    @GetMapping()
    public ResponseEntity<?> getMyOrder() {
        User currentUser =  authService.getCurrentUser();
        List<Order> orders = orderService.getOrdersByUserId(currentUser.getId());
        return ResponseEntity.ok(orders);
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<?> getOrderById(@PathVariable String orderId) {
        Order order = orderService.getOrderById(orderId).orElse(null);
        if (order == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(order);
    }

}
