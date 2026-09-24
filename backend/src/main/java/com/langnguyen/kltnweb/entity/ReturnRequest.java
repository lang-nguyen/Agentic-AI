package com.langnguyen.kltnweb.entity;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import com.fasterxml.jackson.annotation.JsonValue;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "return_requests")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReturnRequest {
	@Id
	private String id;

	@Field("return_id")
	private String returnId;

	@Field("order_id")
	private String orderId;

	@Field("user_id")
	private String userId;

	private RequestType type;
	private ReturnReason reason;
	private RequestStatus status;
	private ActionType action;

	@Field("payment_method_id")
	private String paymentMethodId;

	private List<ReturnItem> items;

	@Field("created_at")
	private LocalDateTime createdAt;

	@Field("updated_at")
	private LocalDateTime updatedAt;

	public enum ActionType {
		REFUND_IMMEDIATELY,
		REFUND_AND_RETURN,
		PARTIAL_REFUND,
		REJECT_REFUND,
		WAIT_FOR_APPROVAL
	}

	public enum RequestStatus {
		PENDING_PROCESSING,
		APPROVED,
		REJECTED
	}

	public enum RequestType {
		RETURN,
		EXCHANGE
	}

	public enum ReturnReason {
		WRONG_SIZE("wrong_size"),
		WRONG_COLOR("wrong_color"),
		WRONG_ITEM("wrong_item"),
		DAMAGED_ITEM("damaged_item"),
		CHANGED_MIND("changed_mind"),
		POOR_QUALITY("poor_quality"),
		OTHER("other");

		private final String value;

		ReturnReason(String value) {
			this.value = value;
		}

		@JsonValue
		public String getValue() {
			return value;
		}

		public static ReturnReason fromValue(String value) {
			for (ReturnReason r : ReturnReason.values()) {
				if (r.value.equalsIgnoreCase(value)) {
					return r;
				}
			}
			throw new IllegalArgumentException("Unknown return reason: " + value);
		}
	}

	@Data
	@NoArgsConstructor
	@AllArgsConstructor
	@Builder
	public static class ReturnItem {
		@Field("item_id")
		private String itemId;

		@Field("product_id")
		private String productId;

		private String name;
		private int quantity;
		private double price;
		private ReturnReason reason;

		@Field("customer_comment")
		private String customerComment;

		private List<String> images;
	}
}
