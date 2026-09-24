package com.langnguyen.kltnweb.seeder;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.langnguyen.kltnweb.entity.Order;
import com.langnguyen.kltnweb.entity.OrderTracking;
import com.langnguyen.kltnweb.entity.Product;
import com.langnguyen.kltnweb.entity.User;
import com.langnguyen.kltnweb.entity.ReturnRequest;
import com.langnguyen.kltnweb.repository.OrderRepository;
import com.langnguyen.kltnweb.repository.OrderTrackingRepository;
import com.langnguyen.kltnweb.repository.ProductRepository;
import com.langnguyen.kltnweb.repository.UserRepository;
import com.langnguyen.kltnweb.repository.ReturnRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataSeeder implements CommandLineRunner {

	private final UserRepository userRepository;
	private final ProductRepository productRepository;
	private final OrderRepository orderRepository;
	private final OrderTrackingRepository orderTrackingRepository;
	private final ReturnRequestRepository returnRequestRepository;
	private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

	@Value("${app.seeder.enabled:false}")
	private boolean seederEnabled;

	@Override
	public void run(String... args) throws Exception {
		if (!seederEnabled) {
			log.info("Data Seeder is disabled. Skipping data seeding.");
			return;
		}

		ObjectMapper objectMapper = new ObjectMapper();
		objectMapper.registerModule(new JavaTimeModule());
		objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
		objectMapper.setPropertyNamingStrategy(com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE);

		userRepository.deleteAll();
		if (userRepository.count() == 0) {
			log.info("Seeding Users...");

			Map<String, User> userMap = objectMapper.readValue(
					new File("data/users.json"),
					new TypeReference<Map<String, User>>() {
					}
			);
			userMap.forEach((k, v) -> {
				v.setId(k);
				if (v.getPassword() == null || v.getPassword().isEmpty()) {
					v.setPassword(passwordEncoder.encode("abc@123"));
				} else {
					v.setPassword(passwordEncoder.encode(v.getPassword()));
				}
				
				List<String> roles = new ArrayList<>();
				roles.add("USER");
				if ("noah_brown_6181".equals(k) || "noah.brown7922@example.com".equals(v.getEmail())) {
					roles.add("ADMIN");
				}
				v.setRoles(roles);
			});
			userRepository.saveAll(userMap.values());
			log.info("Saved {} users", userMap.size());

			// Seed Virtual AI Agent Staff Account
			if (!userRepository.existsById("ai_agent_001")) {
				User agentUser = User.builder()
						.id("ai_agent_001")
						.name(User.Name.builder().firstName("AI").lastName("Agent").build())
						.email("agent@store.com")
						.password(passwordEncoder.encode("abc@123"))
						.roles(List.of("USER", "AGENT"))
						.build();
				userRepository.save(agentUser);
				log.info("Seeded Virtual AI Agent user account");
			}
		}


		productRepository.deleteAll();
		if (productRepository.count() == 0) {
			log.info("Seeding Products...");
			Map<String, Product> productMap = objectMapper.readValue(
					new File("data/products.json"),
					new TypeReference<Map<String, Product>>() {
					}
			);
			productMap.forEach((k, v) -> {
				if (v.getProductId() == null) v.setProductId(k);
			});
			productRepository.saveAll(productMap.values());
			log.info("Saved {} products", productMap.size());
		}

		orderRepository.deleteAll();
		orderTrackingRepository.deleteAll();
		long orderCount = orderRepository.count();
		if (orderCount < 50000) {
			if (orderCount > 0) {
				orderRepository.deleteAll();
			}
			Map<String, Order> orderMap = objectMapper.readValue(
					new File("data/orders.json"),
					new TypeReference<Map<String, Order>>() {
					}
			);

			java.util.Random random = new java.util.Random();
			int currentYear = java.time.LocalDate.now().getYear();
			int currentDayOfYear = java.time.LocalDate.now().getDayOfYear();

			List<OrderTracking> trackings = new ArrayList<>();

			orderMap.forEach((k, v) -> {
				v.setOrderId(k);
				int dayOfYear = random.nextInt(currentDayOfYear) + 1;
				java.time.LocalDate randomDate = java.time.LocalDate.ofYearDay(currentYear, dayOfYear);
				java.time.LocalTime randomTime = java.time.LocalTime.of(
						random.nextInt(24),
						random.nextInt(60),
						random.nextInt(60)
				);
				LocalDateTime randomDateTime = java.time.LocalDateTime.of(randomDate, randomTime);
				v.setCreatedAt(randomDateTime);
				v.setUpdatedAt(randomDateTime);

				// Create tracking events based on order lifecycle status
				OrderTracking created = OrderTracking.builder()
						.orderId(k)
						.event(OrderTracking.TrackingEvent.ORDER_CREATED)
						.message(OrderTracking.TrackingEvent.ORDER_CREATED.getDefaultMessage())
						.createdAt(randomDateTime)
						.updatedAt(randomDateTime)
						.build();
				trackings.add(created);

				if (v.getStatus() != Order.OrderStatus.pending) {
					LocalDateTime confirmedTime = randomDateTime.plusHours(2 + random.nextInt(6));
					OrderTracking confirmed = OrderTracking.builder()
							.orderId(k)
							.event(OrderTracking.TrackingEvent.ORDER_CONFIRMED)
							.message(OrderTracking.TrackingEvent.ORDER_CONFIRMED.getDefaultMessage())
							.createdAt(confirmedTime)
							.updatedAt(confirmedTime)
							.build();
					trackings.add(confirmed);

					if (v.getStatus() != Order.OrderStatus.processed) {
						LocalDateTime deliveredTime = confirmedTime.plusDays(1 + random.nextInt(3));
						OrderTracking delivered = OrderTracking.builder()
								.orderId(k)
								.event(OrderTracking.TrackingEvent.ORDER_DELIVERED)
								.message(OrderTracking.TrackingEvent.ORDER_DELIVERED.getDefaultMessage())
								.createdAt(deliveredTime)
								.updatedAt(deliveredTime)
								.build();
						trackings.add(delivered);

						if (v.getStatus() == Order.OrderStatus.return_requested || v.getStatus() == Order.OrderStatus.exchange_requested) {
							LocalDateTime returnTime = deliveredTime.plusDays(1 + random.nextInt(5));
							OrderTracking returnCreated = OrderTracking.builder()
									.orderId(k)
									.event(OrderTracking.TrackingEvent.RETURN_REQUEST_CREATED)
									.message(OrderTracking.TrackingEvent.RETURN_REQUEST_CREATED.getDefaultMessage())
									.createdAt(returnTime)
									.updatedAt(returnTime)
									.build();
							trackings.add(returnCreated);
						}
					}
				}
			});

			orderRepository.saveAll(orderMap.values());
			orderTrackingRepository.saveAll(trackings);
			log.info("Saved {} orders and {} order trackings successfully.", orderMap.size(), trackings.size());
		}

		returnRequestRepository.deleteAll();
		if (returnRequestRepository.count() == 0) {
			log.info("Seeding Return Requests...");
			File returnRequestsFile = new File("data/return_requests.json");
			if (returnRequestsFile.exists()) {
				List<ReturnRequest> returnRequests = objectMapper.readValue(
						returnRequestsFile,
						new TypeReference<List<ReturnRequest>>() {}
				);
				returnRequestRepository.saveAll(returnRequests);
				log.info("Saved {} return requests successfully.", returnRequests.size());
			} else {
				log.warn("data/return_requests.json not found. Skipping seeding return requests.");
			}
		}

		log.info("Data Seeding Complete.");
	}
}
