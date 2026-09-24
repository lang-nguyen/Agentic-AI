package com.langnguyen.kltnweb.controller.api;

import com.langnguyen.kltnweb.entity.OrderTracking;
import com.langnguyen.kltnweb.entity.ReturnRequest;
import com.langnguyen.kltnweb.service.AuthService;
import com.langnguyen.kltnweb.service.ReturnRequestService;
import com.langnguyen.kltnweb.repository.OrderTrackingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/return-requests")
@RequiredArgsConstructor
public class AdminReturnRequestController {

    private final AuthService authService;
    private final ReturnRequestService returnRequestService;
    private final OrderTrackingRepository orderTrackingRepository;

    @GetMapping()
    public ResponseEntity<?> getAllReturnRequests() {
        List<ReturnRequest> requests = returnRequestService.getAllReturnRequests();
        return ResponseEntity.ok(requests);
    }

    @GetMapping("/{returnId}")
    public ResponseEntity<?> getReturnRequestById(@PathVariable String returnId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        ReturnRequest request = returnRequestService.getReturnRequestByReturnId(returnId).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(request);
    }

    @PostMapping()
    public ResponseEntity<?> createReturnRequest(@RequestBody ReturnRequest returnRequest) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        if (returnRequest.getReturnId() == null || returnRequest.getReturnId().trim().isEmpty()) {
            returnRequest.setReturnId("RET_" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        }
        returnRequest.setCreatedAt(LocalDateTime.now());
        returnRequest.setUpdatedAt(LocalDateTime.now());
        ReturnRequest created = returnRequestService.saveReturnRequest(returnRequest);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{returnId}")
    public ResponseEntity<?> updateReturnRequest(@PathVariable String returnId, @RequestBody ReturnRequest returnRequest) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        ReturnRequest existing = returnRequestService.getReturnRequestByReturnId(returnId).orElse(null);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        returnRequest.setId(existing.getId());
        returnRequest.setReturnId(returnId);
        returnRequest.setUpdatedAt(LocalDateTime.now());
        ReturnRequest updated = returnRequestService.saveReturnRequest(returnRequest);
        return ResponseEntity.ok(updated);
    }

    @PutMapping("/{returnId}/status")
    public ResponseEntity<?> updateReturnRequestStatus(@PathVariable String returnId, @RequestBody Map<String, String> body) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        ReturnRequest request = returnRequestService.getReturnRequestByReturnId(returnId).orElse(null);
        if (request == null) {
            return ResponseEntity.notFound().build();
        }

        String statusStr = body.get("status");
        String actionStr = body.get("action");

        OrderTracking.TrackingEvent trackingEvent = null;

        if (statusStr != null) {
            try {
                ReturnRequest.RequestStatus status = ReturnRequest.RequestStatus.valueOf(statusStr.toUpperCase());
                request.setStatus(status);
                if (status == ReturnRequest.RequestStatus.APPROVED) {
                    trackingEvent = OrderTracking.TrackingEvent.RETURN_APPROVED;
                } else if (status == ReturnRequest.RequestStatus.REJECTED) {
                    trackingEvent = OrderTracking.TrackingEvent.RETURN_REJECTED;
                }
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body("Invalid status value");
            }
        }

        if (actionStr != null) {
            try {
                request.setAction(ReturnRequest.ActionType.valueOf(actionStr.toUpperCase()));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body("Invalid action value");
            }
        }

        request.setUpdatedAt(LocalDateTime.now());
        ReturnRequest updated = returnRequestService.saveReturnRequest(request);

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

        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{returnId}")
    public ResponseEntity<?> deleteReturnRequest(@PathVariable String returnId) {
        if (authService.getCurrentUser() == null) {
            return ResponseEntity.status(401).body("User not authenticated");
        }
        boolean deleted = returnRequestService.deleteReturnRequest(returnId);
        if (!deleted) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok("ReturnRequest deleted successfully");
    }
}
