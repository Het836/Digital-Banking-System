package com.banking.notificationservice.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class NotificationService {

    private final JavaMailSender mailSender;
    private final RestClient restClient = RestClient.create();

    @Value("${account.service.url:http://account-service:8081}")
    private String accountServiceUrl;

    @Value("${notification.mail.from:no-reply@digitalbank.local}")
    private String fromAddress;

    @KafkaListener(topics = "transaction.otp.generated")
    public void consumeOtpGenerated(Map<String, Object> payload) {
        String accountNumber = (String) payload.get("accountNumber");
        String otp = (String) payload.get("otp");
        String transactionId = (String) payload.get("transactionId");
        String amount = String.valueOf(payload.get("amount"));
        Object reasonValue = payload.get("reason");
        String reason = reasonValue instanceof String value && !value.isBlank()
                ? value
                : "Unusual activity detected";

        AccountContact account = restClient
                .get()
                .uri(accountServiceUrl + "/api/v1/accounts/{accountNumber}", accountNumber)
                .retrieve()
                .body(AccountContact.class);

        if (account == null || account.email() == null || account.email().isBlank()) {
            throw new IllegalStateException("No email address is available for account " + accountNumber);
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(account.email());
        message.setSubject("Transfer verification code");
        message.setText(String.format(
                "A transfer of INR %s was held for verification.%n%n" +
                        "Reason: %s%n" +
                        "Your one-time code is %s. It expires in 5 minutes.%n%n" +
                        "If you did not initiate this transfer, do not share this code and contact your bank.%n" +
                        "Reference: %s",
                amount, reason, otp, transactionId
        ));
        mailSender.send(message);
        log.info("OTP email delivered to the local mail server for transaction {}", transactionId);
    }

    /**
     * Transaction completed — debit sender, credit receiver.
     */
    @KafkaListener(topics = "transaction.completed")
    private void consumeTransactionCompleted(Map<String, Object> payload) {
        try {
            String senderAccount = (String) payload.get("senderAccountNumber");
            String receiverAccount = (String) payload.get("receiverAccountNumber");
            String amount = payload.get("amount").toString();

            sendAlert(senderAccount, "DEBIT ALERT",
                    String.format("₹%s debited from account %s",
                            amount, senderAccount));

            sendAlert(receiverAccount, "CREDIT ALERT",
                    String.format("₹%s credited to account %s",
                            amount, receiverAccount));

        } catch (Exception e) {
            log.info("Error sending transaction completion notification: {}",
                    e.getMessage());
        }
    }

    @KafkaListener(topics = "fraud.detected")
    private void consumeFraudDetected(Map<String, Object> payload) {
        try {
            String accountNumber = (String) payload.get("accountNumber");
            String reason = (String) payload.get("reason");

            sendAlert(accountNumber,
                    "🚨 ACCOUNT BLOCKED",
                    String.format(
                            "Your account %s has been blocked. " +
                                    "Reason: %s. " +
                                    "Please contact your bank immediately.",
                            accountNumber, reason));

        } catch (Exception e) {
            log.info("Error sending fraud detection notification: {}",
                    e.getMessage());
        }
    }

    @KafkaListener(topics = "transaction.refunded")
    private void consumeTransactionRefunded(Map<String, Object> payload) {
        try {
            String senderAccount = (String) payload.get("senderAccountNumber");
            String amount = payload.get("amount").toString();
            String reason = (String) payload.get("reason");


            sendAlert(senderAccount, "💰 REFUND PROCESSED",
                    String.format(
                            "Your transaction of ₹%s was cancelled. " +
                                    "Reason: %s. " +
                                    "₹%s has been refunded to account %s.",
                            amount, reason, amount, senderAccount));

        } catch (Exception e) {
            log.info("Error sending transaction refund notification: {}",
                    e.getMessage());
        }
    }

    /**
     * Payment completed via Razorpay.
     */
    @KafkaListener(topics = "payment.completed")
    private void consumePaymentCompleted(Map<String, Object> payload) {
        try {
            String accountNumber = (String) payload.get("accountNumber");
            String amount = payload.get("amount").toString();

            sendAlert(accountNumber, "PAYMENT SUCCESSFUL",
                    String.format(
                            "Payment of ₹%s completed. " +
                                    "Razorpay ID: %s",
                            amount, payload.get("razorpayPaymentId")));

        } catch (Exception e) {
            log.info("Error sending payment completion notification: {}",
                    e.getMessage());
        }
    }

    /**
     * Payment failed via Razorpay.
     */
    @KafkaListener(topics = "payment.failed")
    private void consumePaymentFailed(Map<String, Object> payload) {
        try {
            String accountNumber = (String) payload.get("accountNumber");
            String amount = payload.get("amount").toString();

            sendAlert(accountNumber, "❌ PAYMENT FAILED",
                    String.format(
                            "Your payment of ₹%s could not be processed. " +
                                    "Please try again or contact support.",
                            amount));

        } catch (Exception e) {
            log.info("Error sending payment failure notification: {}",
                    e.getMessage());
        }
    }

    private void sendAlert(String accountNumber,
                           String subject,
                           String message){
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        log.info("NOTIFICATION SENT");
        log.info("Account : {}", accountNumber);
        log.info("Subject : {}", subject);
        log.info("Message : {}", message);
        log.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    }

    private record AccountContact(String email) {
    }
}
