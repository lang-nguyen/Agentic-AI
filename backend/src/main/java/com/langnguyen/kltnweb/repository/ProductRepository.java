package com.langnguyen.kltnweb.repository;

import com.langnguyen.kltnweb.domain.dto.ProductSummaryDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.mongodb.repository.Aggregation;
import org.springframework.data.mongodb.repository.MongoRepository;
import com.langnguyen.kltnweb.entity.Product;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends MongoRepository<Product, String> {
	String PROJECT_PRODUCT_SUMMARY = """
			{
				$project: {
					     name: 1,
					     display_name: 1,
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
					     image: {
					       $arrayElemAt: [
					         {
					           $arrayElemAt: [
					             {
					               $map: {
					                 input: {
					                   $objectToArray: "$variants"
					                   },
					                 as: 'item',
					                 in: '$$item.v.images'
					               }
					             },
					             0
					           ]
					         },
					         0
					       ]
					     }
					}
			}
			""";

	@Aggregation(pipeline = {
			PROJECT_PRODUCT_SUMMARY
	})
	List<ProductSummaryDTO> findAllProductSummary();

	@Aggregation(pipeline = {
			PROJECT_PRODUCT_SUMMARY,
			"""
					{
					$match:  {
					         _id: ?0
					       }
					}
					"""
	})
	Optional<ProductSummaryDTO> findSummaryById(String productId);
}
