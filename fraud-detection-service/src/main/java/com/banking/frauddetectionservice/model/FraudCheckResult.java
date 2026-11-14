package com.banking.frauddetectionservice.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class FraudCheckResult {
    private boolean fraud;
    private String reason;
}
