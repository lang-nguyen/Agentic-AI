package com.langnguyen.kltnweb.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.langnguyen.kltnweb.entity.ChatMessage;

import java.util.List;

public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {
	List<ChatMessage> findBySessionIdOrderByTimestampAsc(String sessionId);

	List<ChatMessage> findByUserIdOrderByTimestampDesc(String userId);
}
