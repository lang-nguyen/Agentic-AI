package com.langnguyen.kltnweb.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class ReturnEvaluationResultDTO {

    @JsonProperty("request_id")
    private String requestId;

    @JsonProperty("rule_id")
    private String ruleId;

    private String mode;
    private String status;
    private String action;

    @JsonProperty("ai_summary_for_staff")
    private String aiSummaryForStaff;

    @JsonProperty("message_to_customer")
    private String messageToCustomer;
}
