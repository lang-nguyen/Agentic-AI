package com.langnguyen.kltnweb.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Lưu lại lịch sử tin nhắn giữa user và AI chatbot.
 */
@Document(collection = "chat_messages")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChatMessage {
    @Id
    private String id;
    private String sessionId;
    private String userId;
    private String sender; // USER, AI
    private String content;
    private LocalDateTime timestamp;
}
