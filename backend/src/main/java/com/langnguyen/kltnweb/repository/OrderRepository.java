package com.langnguyen.kltnweb.repository;

import org.springframework.data.mongodb.repository.MongoRepository;
import com.langnguyen.kltnweb.entity.Order;

import java.util.List;

public interface OrderRepository extends MongoRepository<Order, String> {
	List<Order> findByUserId(String userId);
}
