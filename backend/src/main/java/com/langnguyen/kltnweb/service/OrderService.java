package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.entity.Order;
import com.langnguyen.kltnweb.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class OrderService {

	private final OrderRepository orderRepository;

	public List<Order> getOrdersByUserId(String userId) {
		return orderRepository.findByUserId(userId);
	}

	public List<Order> getAllOrders() {
		return orderRepository.findAll();
	}

	public Optional<Order> getOrderById(String orderId) {
		return orderRepository.findById(orderId);
	}

	public double getOrderTotal(Order order) {
		if (order.getItems() == null) return 0;
		return order.getItems().stream()
				.mapToDouble(item -> item.getPrice() * Math.max(1, item.getQuantity()))
				.sum();
	}

	/**
	 * Lấy tổng số items trong order.
	 */
	public int getItemCount(Order order) {
		return order.getItems() != null ? order.getItems().stream().mapToInt(item -> Math.max(1, item.getQuantity())).sum() : 0;
	}

	public Order saveOrder(Order order) {
		return orderRepository.save(order);
	}

	public Optional<Order> updateOrderStatus(String orderId, String status) {
		return orderRepository.findById(orderId).map(existing -> {
			try {
				existing.setStatus(Order.OrderStatus.valueOf(status.toLowerCase()));
			} catch (IllegalArgumentException e) {
				// Fallback to pending if invalid status is sent
				existing.setStatus(Order.OrderStatus.pending);
			}
			return orderRepository.save(existing);
		});
	}

	public boolean deleteOrder(String orderId) {
		if (orderRepository.existsById(orderId)) {
			orderRepository.deleteById(orderId);
			return true;
		}
		return false;
	}
}
