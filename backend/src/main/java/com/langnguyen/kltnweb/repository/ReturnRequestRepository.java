package com.langnguyen.kltnweb.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.langnguyen.kltnweb.entity.ReturnRequest;

import java.util.List;
import java.util.Optional;

public interface ReturnRequestRepository extends MongoRepository<ReturnRequest, String> {
	List<ReturnRequest> findByStatus(ReturnRequest.RequestStatus status);

	List<ReturnRequest> findByUserId(String userId);

	Optional<ReturnRequest> findByReturnId(String returnId);

	List<ReturnRequest> findByOrderId(String orderId);

	List<ReturnRequest> findAllByOrderByCreatedAtDesc();
}
