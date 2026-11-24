package com.banking.transactionservice.service;

import com.banking.transactionservice.entity.Transaction;
import com.banking.transactionservice.entity.TranscationStatus;
import com.banking.transactionservice.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
@RequiredArgsConstructor
public class TransactionEventConsumer{

    private final TransactionRepository transactionRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final TransactionService transactionService;
    private static final long OTP_EXPIRY_MINUTES = 5;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String TRANSACTION_OTP_GENERATED_TOPIC = "transaction.otp.generated";

    /*
    Consume verification required
    Generate OTP and ask the user to verify.
     */
    @KafkaListener(topics = "verification.required")
    public void consumeVerificationRequired(
            @Payload Map<String, Object> payload
    ) {
        String transactionId = (String) payload.get("transactionId");
        String accountNumber = (String) payload.get("accountNumber");
        String reason = (String) payload.get("reason");

        log.info("Verification required - transaction: {} reason: {}",
                transactionId, reason);

        Transaction transaction = transactionRepository.findById(transactionId)
                .orElseThrow(() -> new RuntimeException(
                        "Transaction not found: " + transactionId
                ));
        if (transaction.getStatus() != TranscationStatus.PROCESSING
                && transaction.getStatus() != TranscationStatus.PENDING_VERIFICATION) {
            log.warn("Transaction {} is {}, skipping OTP generation", transactionId, transaction.getStatus());
            return;
        }

        String otpKey = "verification:otp" + transactionId;
        String otp = redisTemplate.opsForValue().get(otpKey);
        if (transaction.getStatus() == TranscationStatus.PROCESSING || otp == null) {
            otp = String.format("%06d", SECURE_RANDOM.nextInt(100_000, 1_000_000));
            redisTemplate.opsForValue().set(otpKey, otp, OTP_EXPIRY_MINUTES, TimeUnit.MINUTES);
        }
        if (transaction.getStatus() == TranscationStatus.PROCESSING) {
            transaction.setStatus(TranscationStatus.PENDING_VERIFICATION);
            transactionRepository.save(transaction);
        }

        Map<String, Object> otpEvent = new HashMap<>();
        otpEvent.put("transactionId", transactionId);
        otpEvent.put("accountNumber", accountNumber);
        otpEvent.put("reason", reason);
        otpEvent.put("otp", otp);
        otpEvent.put("amount", payload.get("amount"));

        kafkaTemplate.send(TRANSACTION_OTP_GENERATED_TOPIC, transactionId, otpEvent).join();
        log.info("OTP notification queued for transaction {} with {} minute expiry",
                transactionId, OTP_EXPIRY_MINUTES);
    }

    @KafkaListener(topics = "fraud.check.clean")
    public void consumerFraudCheckCleanResult(
            @Payload Map<String, Object> payload
    ){
        try{
            String transactionId = (String) payload.get("transactionId");
            transactionService.processCleanResult(transactionId);
        } catch (Exception e) {
            log.error("Error processing fraud check result: {}", e.getMessage());
        }
    }
}
