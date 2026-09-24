package com.langnguyen.kltnweb.entity;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.List;
import java.util.Map;

@Document(collection = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class User {
	@Id
	private String id;

	private Name name;
	private Address address;
	private String email;
	private String password;
	private List<String> roles = new java.util.ArrayList<>();

	@Field("payment_methods")
	private Map<String, Object> paymentMethods;

	private List<String> orders;

	@Field("cart_items")
	private List<CartItem> cartItems;

	@Transient
	public String getFullName() {
		if (name == null) return id;
		return name.getFirstName() + " " + name.getLastName();
	}

	@Data
	@Builder
	@NoArgsConstructor
	@AllArgsConstructor
	public static class Name {
		@Field("first_name")
		private String firstName;
		@Field("last_name")
		private String lastName;
	}
}
