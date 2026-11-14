package com.banking.accountservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class AccountEventConsumer {

    private final AccountService accountService;

    /**
     * Zoom transaction.completed event from Kafka
     * Credits receiver amount
     */
    @KafkaListener(topics = "transaction.completed")
    public void consumeTransactionCompleted(
            @Payload Map<String, Object> payload
            ){
        try {
            String receiverAccount = payload.get("receiverAccountNumber").toString();
            BigDecimal amount = new BigDecimal(payload.get("amount").toString());

            log.info("Crediting account {} with amount {}", receiverAccount, amount);
            accountService.creditBalance(receiverAccount, amount);
        } catch (Exception e) {
            log.error("Error occurred while crediting account: {}", e.getMessage());
        }
    }

    /**
     * Consume fraud.detected event from Kafka
     * Blocks the flagged account.
     */
    @KafkaListener(topics = "fraud.detected")
    public void consumeFraudDetected(
            @Payload Map<String, Object> payload
    ) {
        try {
            String flaggedAccount = payload.get("accountNumber").toString();

            log.info("Fraud detected - blocking account: {}", flaggedAccount);
            accountService.blockAccount(flaggedAccount);
        } catch (Exception e) {
            log.error("Error occurred while blocking flagged account: {}", e.getMessage());
        }
    }
}
