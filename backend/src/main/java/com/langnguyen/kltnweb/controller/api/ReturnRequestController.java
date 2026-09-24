package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.domain.dto.ReturnEvaluationResultDTO;
import com.langnguyen.kltnweb.domain.dto.ReturnRequestDTO;
import com.langnguyen.kltnweb.entity.Order;
import com.langnguyen.kltnweb.entity.OrderTracking;
import com.langnguyen.kltnweb.entity.ReturnRequest;
import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.AiService;
import com.langnguyen.kltnweb.repository.OrderRepository;
import com.langnguyen.kltnweb.repository.OrderTrackingRepository;
import com.langnguyen.kltnweb.repository.ReturnRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import com.langnguyen.kltnweb.service.CloudinaryService;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/return-requests")
@RequiredArgsConstructor
@Slf4j
public class ReturnRequestController {

    private final AuthService authService;
    private final ReturnRequestRepository returnRequestRepository;
    private final OrderRepository orderRepository;
    private final OrderTrackingRepository orderTrackingRepository;
    private final AiService aiService;
    private final CloudinaryService cloudinaryService;

    @GetMapping()
    public ResponseEntity<?> getMyReturnRequests() {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        List<ReturnRequest> requests = returnRequestRepository.findByUserId(user.getId());
        requests.sort(Comparator.comparing(ReturnRequest::getCreatedAt).reversed());
        return ResponseEntity.ok(requests);
    }

    @GetMapping("/reasons")
    public ResponseEntity<?> getReasonList() {
        return ResponseEntity.ok(ReturnRequest.ReturnReason.values());
    }

    @PostMapping()
    public ResponseEntity<?> createReturnRequest(@RequestBody ReturnRequestDTO dto) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }

        // Fetch original order to extract item details securely
        Order order = orderRepository.findById(dto.getOrderId()).orElse(null);
        if (order == null) {
            return ResponseEntity.status(404).body("Order not found");
        }

        // Populate return items from order details
        List<ReturnRequest.ReturnItem> entityItems = new ArrayList<>();
        if (dto.getItemIds() != null && order.getItems() != null) {
            for (String itemId : dto.getItemIds()) {
                Order.OrderItem orderItem = order.getItems().stream()
                    .filter(oi -> itemId.equals(oi.getItemId()))
                    .findFirst()
                    .orElse(null);

                if (orderItem != null) {
                    ReturnRequest.ReturnItem returnItem = ReturnRequest.ReturnItem.builder()
                        .itemId(itemId)
                        .productId(orderItem.getProductId())
                        .name(orderItem.getName())
                        .quantity(orderItem.getQuantity())
                        .price(orderItem.getPrice())
                        .reason(dto.getReason())
                        .customerComment(dto.getCustomerComment())
                        .images(dto.getImages() != null ? dto.getImages() : new ArrayList<>())
                        .build();
                    entityItems.add(returnItem);
                }
            }
        }

        ReturnRequest request = ReturnRequest.builder()
                .returnId("RET_" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase())
                .orderId(dto.getOrderId())
                .userId(user.getId())
                .type(dto.getType())
                .reason(dto.getReason())
                .paymentMethodId(dto.getPaymentMethodId())
                .status(ReturnRequest.RequestStatus.PENDING_PROCESSING)
                .items(entityItems)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        ReturnRequest saved = returnRequestRepository.save(request);

        // Save OrderTracking Event for RETURN_REQUEST_CREATED
        OrderTracking tracking = OrderTracking.builder()
                .orderId(dto.getOrderId())
                .event(OrderTracking.TrackingEvent.RETURN_REQUEST_CREATED)
                .message(OrderTracking.TrackingEvent.RETURN_REQUEST_CREATED.getDefaultMessage())
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();
        orderTrackingRepository.save(tracking);

        // Trigger AI evaluation asynchronously in a separate thread
        new Thread(() -> aiService.triggerEvaluation(saved)).start();

        return ResponseEntity.ok(saved);
    }

    @PostMapping("/webhook")
    public ResponseEntity<?> receiveWebhook(@RequestBody ReturnEvaluationResultDTO webhookResult) {
        ReturnRequest request = returnRequestRepository.findByReturnId(webhookResult.getRequestId()).orElse(null);
        log.info("Webhook Smart Return Result {}", webhookResult);
        if (request == null) {
            return ResponseEntity.status(404).body("ReturnRequest not found");
        }

        // Map status from AI evaluation result
        String statusStr = webhookResult.getStatus();
        OrderTracking.TrackingEvent trackingEvent = null;

        if ("APPROVED".equalsIgnoreCase(statusStr)) {
            request.setStatus(ReturnRequest.RequestStatus.APPROVED);
            trackingEvent = OrderTracking.TrackingEvent.RETURN_APPROVED;
        } else if ("REJECTED".equalsIgnoreCase(statusStr)) {
            request.setStatus(ReturnRequest.RequestStatus.REJECTED);
            trackingEvent = OrderTracking.TrackingEvent.RETURN_REJECTED;
        } else {
            request.setStatus(ReturnRequest.RequestStatus.PENDING_PROCESSING);
        }

        // Set evaluated action outcome
        if (webhookResult.getAction() != null) {
            try {
                request.setAction(ReturnRequest.ActionType.valueOf(webhookResult.getAction().toUpperCase()));
            } catch (IllegalArgumentException e) {
                request.setAction(null);
            }
        } else {
            request.setAction(null);
        }

        request.setUpdatedAt(LocalDateTime.now());
        returnRequestRepository.save(request);

        // Save OrderTracking Event if approved or rejected
        if (trackingEvent != null) {
            OrderTracking tracking = OrderTracking.builder()
                    .orderId(request.getOrderId())
                    .event(trackingEvent)
                    .message(trackingEvent.getDefaultMessage())
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();
            orderTrackingRepository.save(tracking);
        }

        return ResponseEntity.ok("Webhook processed successfully");
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadEvidence(@RequestParam("file") MultipartFile file) {
        User user = authService.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        try {
            String secureUrl = cloudinaryService.uploadImage(file);
            return ResponseEntity.ok(Map.of("url", secureUrl));
        } catch (Exception e) {
            log.error("Failed to upload return request evidence image to Cloudinary", e);
            return ResponseEntity.status(500).body("Upload failed: " + e.getMessage());
        }
    }
}
