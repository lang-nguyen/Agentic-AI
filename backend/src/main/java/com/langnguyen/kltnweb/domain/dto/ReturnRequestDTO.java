package com.langnguyen.kltnweb.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.langnguyen.kltnweb.entity.ReturnRequest;
import lombok.Data;

import java.util.List;

@Data
public class ReturnRequestDTO {

    @JsonProperty("order_id")
    private String orderId;

    private ReturnRequest.RequestType type;
    private ReturnRequest.ReturnReason reason;

    @JsonProperty("payment_method_id")
    private String paymentMethodId;

    @JsonProperty("customer_comment")
    private String customerComment;

    @JsonProperty("item_ids")
    private List<String> itemIds;

    private List<String> images;
}
