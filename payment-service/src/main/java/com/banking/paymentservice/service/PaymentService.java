package com.banking.paymentservice.service;

import com.banking.paymentservice.dto.CreatePaymentRequest;
import com.banking.paymentservice.dto.PaymentOrderResponse;
import com.banking.paymentservice.dto.VerifyPaymentRequest;
import com.banking.paymentservice.entity.Payment;
import com.banking.paymentservice.entity.PaymentStatus;
import com.banking.paymentservice.repository.PaymentRepository;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    private static final String PAYMENT_COMPLETED_TOPIC = "payment.completed";
    private static final String PAYMENT_FAILED_TOPIC = "payment.failed";

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    /**
     * Create a Razorpay payment order.
     *
     * FLOW:
     *  1. Create an order in Razorpay.
     *  2. Save payment record in DB.
     *  3. Return order detail to frontend.
     *  4. Frontend show Razorpay checkout
     *  5. Use pays.
     *  6. Reserve calls webhook.
     */
    public PaymentOrderResponse createPaymentOrder(CreatePaymentRequest request)throws Exception{
        log.info("Creating payment order for account: {} amount: {}",
                request.getAccountNumber(), request.getAmount());

        RazorpayClient razorpayClient = new RazorpayClient(keyId, keySecret);

        // Razorpay accepts payment amounts in the smallest currency unit.
        int amountPaise = request.getAmount()
                .multiply(BigDecimal.valueOf(100))
                .intValueExact();


        JSONObject orderRequest = new JSONObject();
        orderRequest.put("amount", amountPaise);
        orderRequest.put("currency", "INR");
        orderRequest.put("receipt", "recp_"+ System.currentTimeMillis() + UUID.randomUUID().toString()
                .replace("-", "").substring(0,10));

        Order razorpayOrder = razorpayClient.orders.create(orderRequest);
        log.info("Razorpay order created: {}", razorpayOrder.get("id").toString());

        // Save payment records
        Payment payment = Payment.builder()
                .razorpayOrderId(razorpayOrder.get("id").toString())
                .accountNumber(request.getAccountNumber())
                .amount(request.getAmount())
                .currency("INR")
                .status(PaymentStatus.CREATED)
                .description(request.getDescription())
                .build();

        Payment saved = paymentRepository.save(payment);

        return PaymentOrderResponse.builder()
                .paymentId(saved.getId())
                .razorpayOrderId(razorpayOrder.get("id").toString())
                .amount(request.getAmount())
                .currency("INR")
                .razorpayKeyId(keyId)
                .status("CREATED")
                .build();

    }

    public PaymentOrderResponse verifyPayment(VerifyPaymentRequest request) throws Exception {
        JSONObject attributes = new JSONObject();
        attributes.put("razorpay_order_id", request.getRazorpayOrderId());
        attributes.put("razorpay_payment_id", request.getRazorpayPaymentId());
        attributes.put("razorpay_signature", request.getRazorpaySignature());

        if (!Utils.verifyPaymentSignature(attributes, keySecret)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Razorpay payment signature");
        }

        Payment payment = paymentRepository.findByRazorpayOrderId(request.getRazorpayOrderId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment order not found"));

        if (payment.getStatus() == PaymentStatus.COMPLETED) {
            if (!request.getRazorpayPaymentId().equals(payment.getRazorpayPaymentId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Payment order was already completed");
            }
            return toPaymentOrderResponse(payment);
        }

        payment.setRazorpayPaymentId(request.getRazorpayPaymentId());
        payment.setStatus(PaymentStatus.COMPLETED);
        Payment completed = paymentRepository.save(payment);

        Map<String, Object> event = new HashMap<>();
        event.put("paymentId", completed.getId());
        event.put("accountNumber", completed.getAccountNumber());
        event.put("amount", completed.getAmount());
        event.put("razorpayPaymentId", completed.getRazorpayPaymentId());
        kafkaTemplate.send(PAYMENT_COMPLETED_TOPIC, completed.getId(), event);

        return toPaymentOrderResponse(completed);
    }

    private PaymentOrderResponse toPaymentOrderResponse(Payment payment) {
        return PaymentOrderResponse.builder()
                .paymentId(payment.getId())
                .razorpayOrderId(payment.getRazorpayOrderId())
                .amount(payment.getAmount())
                .currency(payment.getCurrency())
                .razorpayKeyId(keyId)
                .status(payment.getStatus().name())
                .build();
    }

    public void handleWebhook(Map<String, Object> payload){
        log.info("Received Razorpay webhook: {}", payload.get("event"));

        String event = (String) payload.get("event");

        if("payment.captured".equals(event)){
            handlePaymentSuccess(payload);
        } else if ("payment.failed".equals(event)) {
            handlePaymentFailure(payload);
        }
    }

    private void handlePaymentSuccess(Map<String, Object> payload) {
        try {
            Map<String, Object> paymentData = extractPaymentData(payload);
            String orderId = (String) paymentData.get("order_id");
            String paymentId = (String) paymentData.get("id");

            Payment payment = paymentRepository.findByRazorpayOrderId(orderId)
                    .orElseThrow(() -> new RuntimeException(
                            "Payment not found for order: " + orderId));

            payment.setRazorpayPaymentId(paymentId);
            payment.setStatus(PaymentStatus.COMPLETED);
            paymentRepository.save(payment);

            // Publish payment completed event.
            Map<String, Object> event = new HashMap<>();
            event.put("paymentId", payment.getId());
            event.put("accountNumber", payment.getAccountNumber());
            event.put("amount", payment.getAmount());
            event.put("razorpayPaymentId", paymentId);

            kafkaTemplate.send(PAYMENT_COMPLETED_TOPIC, payment.getId(), event);

            log.info("Payment completed: {}", payment.getId());
        } catch (Exception e) {
            log.error("Error occurred while handling payment success: {}", e.getMessage());
        }
    }

    private void handlePaymentFailure(Map<String, Object> payload) {
        try {
            Map<String, Object> paymentData = extractPaymentData(payload);
            String orderId = (String) paymentData.get("order_id");

            Payment payment = paymentRepository.findByRazorpayOrderId(orderId)
                    .orElseThrow(() -> new RuntimeException(
                            "Payment not found for order: " + orderId));

            payment.setStatus(PaymentStatus.FAILED);
            payment.setFailureReason("Payment failed via razorpay");
            paymentRepository.save(payment);

            // Publish payment completed event.
            Map<String, Object> event = new HashMap<>();
            event.put("paymentId", payment.getId());
            event.put("accountNumber", payment.getAccountNumber());
            event.put("amount", payment.getAmount());
            event.put("reason", "Payment failed via razorpay");
            kafkaTemplate.send(PAYMENT_FAILED_TOPIC, payment.getId(), event);

            log.warn("Payment failed: {}", payment.getId());
        } catch (Exception e) {
            log.error("Error handling payment failure: {}", e.getMessage());
        }
    }

    private Map<String, Object> extractPaymentData(Map<String, Object> payload) {
        Map<String, Object> entity = (Map<String, Object>) payload.get("payload");
        Map<String, Object> paymentWrapper = (Map<String, Object>) entity.get("payment");
        return (Map<String, Object>) paymentWrapper.get("entity");
    }

}
