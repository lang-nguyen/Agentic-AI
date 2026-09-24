package com.langnguyen.kltnweb.service;

import com.langnguyen.kltnweb.domain.dto.ProductSummaryDTO;
import com.langnguyen.kltnweb.entity.Product;
import com.langnguyen.kltnweb.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

	private final ProductRepository productRepository;
	private final MongoTemplate mongoTemplate;

	public Page<ProductSummaryDTO> getProducts(int page, int size, String keyword, String priceRange) {
		Pageable pageable = PageRequest.of(page, size);
		List<AggregationOperation> baseStages = buildAggregationStages(keyword, priceRange);

		long total = executeCountAggregation(baseStages);
		List<ProductSummaryDTO> content = executeResultsAggregation(baseStages, page, size);

		return new PageImpl<>(content, pageable, total);
	}

	private List<AggregationOperation> buildAggregationStages(String keyword, String priceRange) {
		List<AggregationOperation> stages = new ArrayList<>();

		// 1. Filter by keyword (applied before projection to leverage indexes on name/display_name if available)
		if (keyword != null && !keyword.trim().isEmpty()) {
			String kw = keyword.trim();
			stages.add(Aggregation.match(
				new Criteria().orOperator(
					Criteria.where("name").regex(kw, "i"),
					Criteria.where("display_name").regex(kw, "i")
				)
			));
		}

		// 2. Projection stage (computes min_price and image dynamically)
		String projectJson = """
		{
			$project: {
					 name: 1,
					 display_name: 1,
					 main_image: 1,
					 option_images: 1,
					 variants: 1,
					 min_price: {
					   $min: {
						 $map: {
						   input: {
							 $objectToArray: "$variants"
						   },
						   as: "item",
						   in: "$$item.v.price"
						 }
					   }
					 },
					 image: "$main_image"
				}
		}
		""";
		stages.add(context -> org.bson.Document.parse(projectJson));

		// 3. Filter by price range (applied after projection because min_price is calculated in projection)
		if (priceRange != null && !priceRange.isEmpty()) {
			double minPrice = 0;
			double maxPrice = Double.MAX_VALUE;

			switch (priceRange) {
				case "0-50" -> maxPrice = 50;
				case "50-200" -> {
					minPrice = 50;
					maxPrice = 200;
				}
				case "200-500" -> {
					minPrice = 200;
					maxPrice = 500;
				}
				case "500-" -> minPrice = 500;
			}
			stages.add(Aggregation.match(Criteria.where("min_price").gte(minPrice).lte(maxPrice)));
		}

		return stages;
	}

	private long executeCountAggregation(List<AggregationOperation> baseStages) {
		List<AggregationOperation> countStages = new ArrayList<>(baseStages);
		countStages.add(Aggregation.count().as("total"));
		AggregationResults<org.bson.Document> countResults = mongoTemplate.aggregate(
			Aggregation.newAggregation(countStages), "products", org.bson.Document.class
		);
		if (!countResults.getMappedResults().isEmpty()) {
			return ((Number) countResults.getMappedResults().get(0).get("total")).longValue();
		}
		return 0;
	}

	private List<ProductSummaryDTO> executeResultsAggregation(List<AggregationOperation> baseStages, int page, int size) {
		List<AggregationOperation> resultStages = new ArrayList<>(baseStages);
		resultStages.add(Aggregation.skip((long) page * size));
		resultStages.add(Aggregation.limit(size));
		AggregationResults<ProductSummaryDTO> results = mongoTemplate.aggregate(
			Aggregation.newAggregation(resultStages), "products", ProductSummaryDTO.class
		);
		return results.getMappedResults();
	}

	public List<Product> getAllProducts() {
		return productRepository.findAll();
	}

	public Optional<ProductSummaryDTO> getProductSummaryById(String productId) {
		return productRepository.findSummaryById(productId);
	}

	/**
	 * Lấy giá thấp nhất của sản phẩm (từ tất cả variants).
	 */
	public double getMinPrice(Product product) {
		if (product.getVariants() == null || product.getVariants().isEmpty()) {
			return 0;
		}
		return product.getVariants().values().stream()
				.mapToDouble(Product.Variant::getPrice)
				.min()
				.orElse(0);
	}

	/**
	 * Lấy hình ảnh đầu tiên của sản phẩm.
	 */
	public String getFirstImage(Product product) {
		if (product.getMainImage() != null && !product.getMainImage().trim().isEmpty()) {
			return product.getMainImage();
		}
		return "/images/no-image.png";
	}

	public Product createProduct(Product product) {
		if (product.getProductId() == null || product.getProductId().trim().isEmpty()) {
			product.setProductId("PROD_" + java.util.UUID.randomUUID().toString().substring(0, 8).toUpperCase());
		}
		return productRepository.save(product);
	}

	public Optional<Product> updateProduct(String productId, Product updatedProduct) {
		return productRepository.findById(productId).map(existing -> {
			existing.setName(updatedProduct.getName());
			existing.setDisplayName(updatedProduct.getDisplayName());
			existing.setMainImage(updatedProduct.getMainImage());
			existing.setOptionImages(updatedProduct.getOptionImages());
			existing.setVariants(updatedProduct.getVariants());
			return productRepository.save(existing);
		});
	}

	public boolean deleteProduct(String productId) {
		if (productRepository.existsById(productId)) {
			productRepository.deleteById(productId);
			return true;
		}
		return false;
	}
}
