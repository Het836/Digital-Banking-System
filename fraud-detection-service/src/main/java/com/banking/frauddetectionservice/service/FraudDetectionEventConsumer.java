package com.banking.frauddetectionservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class FraudDetectionEventConsumer {

    private final FraudDetectionService fraudDetectionService;

    /**
     * Listens to transaction.initiated topic.
     * Every transaction goes through fraud check be fore completing.
     */
    public void consumeTransactionInitiated(
            @Payload Map<String, Object> paylod
    ){
        log.info("Received transaction initiated event for fraud check: {}", paylod.get("transactionId"));
        try{
            fraudDetectionService.checkTransaction(paylod);
        } catch (Exception e) {
            log.error("Error occurred while checking transaction for fraud: {}", paylod.get("transactionId"), e);
        }
    }
}
