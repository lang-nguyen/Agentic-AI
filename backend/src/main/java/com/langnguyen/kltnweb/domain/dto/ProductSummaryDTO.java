package com.langnguyen.kltnweb.domain.dto;

import com.langnguyen.kltnweb.entity.Product;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.mongodb.core.mapping.Field;

@Setter
@Getter
public class ProductSummaryDTO extends Product {
	@Field("min_price")
	private double minPrice;
	@Field("image")
	private String image;
}
