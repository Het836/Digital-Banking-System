package com.banking.transactionservice.dto;

import com.banking.transactionservice.entity.TranscationStatus;
import com.banking.transactionservice.entity.TranscationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TransactionResponse {
    private String id;
    private String senderAccountNumber;
    private String receiverAccountNumber;
    private BigDecimal amount;
    private TranscationType type;
    private TranscationStatus status;
    private String description;
    private String failureReason;
    private String referenceNumber;
    private LocalDateTime createdAt;
    private LocalDateTime completedAt;
}
