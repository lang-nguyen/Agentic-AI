package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.entity.ReturnRequest;
import com.langnguyen.kltnweb.repository.ReturnRequestRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ReturnRequestService {

	private final ReturnRequestRepository returnRequestRepository;

	public List<ReturnRequest> getAllReturnRequests() {
		return returnRequestRepository.findAllByOrderByCreatedAtDesc();
	}

	public Optional<ReturnRequest> getReturnRequestById(String id) {
		return returnRequestRepository.findById(id);
	}

	public Optional<ReturnRequest> getReturnRequestByReturnId(String returnId) {
		return returnRequestRepository.findByReturnId(returnId);
	}

	public ReturnRequest saveReturnRequest(ReturnRequest returnRequest) {
		return returnRequestRepository.save(returnRequest);
	}

	public boolean deleteReturnRequest(String returnId) {
		return returnRequestRepository.findByReturnId(returnId).map(existing -> {
			returnRequestRepository.delete(existing);
			return true;
		}).orElse(false);
	}
}
