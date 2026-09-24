package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.entity.ReturnRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiService {

    @Value("${app.ai.base-url:http://localhost:8000}")
    private String aiBaseUrl;

    @Value("${app.webhook.base-url:http://localhost:8080}")
    private String webhookBaseUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    public void triggerEvaluation(ReturnRequest returnRequest) {
        try {
            String url = aiBaseUrl + "/api/smart-return/evaluate";

            double totalValue = 0.0;
            String category = "other";
            if (returnRequest.getItems() != null && !returnRequest.getItems().isEmpty()) {
                totalValue = returnRequest.getItems().stream()
                        .mapToDouble(item -> item.getPrice() * Math.max(1, item.getQuantity()))
                        .sum();

                if (returnRequest.getItems().get(0).getName() != null) {
                    category = returnRequest.getItems().get(0).getName();
                }
            }

            String userText = returnRequest.getItems() != null && !returnRequest.getItems().isEmpty()
                    ? returnRequest.getItems().get(0).getCustomerComment()
                    : "";

            Map<String, Object> payload = new HashMap<>();
            payload.put("request_id", returnRequest.getReturnId());
            payload.put("days_since_delivery", 5);
            payload.put("category", category);
            payload.put("item_value", totalValue);
            payload.put("user_text_description", userText);

            String callbackUrl = webhookBaseUrl + "/api/return-requests/webhook";
            payload.put("callback_url", callbackUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(payload, headers);

            log.info("Sending return request {} to AI Service at {} with callback {}", 
                     returnRequest.getReturnId(), url, callbackUrl);

            restTemplate.postForObject(url, entity, Map.class);
        } catch (Exception e) {
            log.error("Failed to trigger AI evaluation for ReturnRequest: {}", returnRequest.getReturnId(), e);
        }
    }
}
