package com.banking.paymentservice.controller;

import com.banking.paymentservice.dto.CreatePaymentRequest;
import com.banking.paymentservice.dto.PaymentOrderResponse;
import com.banking.paymentservice.dto.VerifyPaymentRequest;
import com.banking.paymentservice.service.PaymentService;
import com.razorpay.RazorpayException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/payments")
@RequiredArgsConstructor
@Slf4j
public class PaymentController {

    private final PaymentService paymentService;

    // Create Razorpay payment order.
    @PostMapping("/create-order")
    public ResponseEntity<PaymentOrderResponse> createPaymentOrder(
            @Valid @RequestBody CreatePaymentRequest request
            ) throws Exception{
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(paymentService.createPaymentOrder(request));
    }

    @PostMapping("/verify")
    public ResponseEntity<PaymentOrderResponse> verifyPayment(
            @Valid @RequestBody VerifyPaymentRequest request
    ) throws Exception {
        return ResponseEntity.ok(paymentService.verifyPayment(request));
    }

    @ExceptionHandler(RazorpayException.class)
    public ResponseEntity<Map<String, String>> handleRazorpayError(RazorpayException exception) {
        log.warn("Razorpay API request failed: {}", exception.getMessage());
        String message = exception.getMessage() != null && exception.getMessage().contains("Authentication failed")
                ? "Razorpay rejected the API credentials. Confirm the key ID and secret are a matching pair from the same Test mode account, then restart the payment-service container."
                : "Razorpay could not create the payment order. Check the amount, currency, and Payment Service logs.";
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                .body(Map.of("message", message));
    }

    // Razorpay webhook endpoint
    public ResponseEntity<String> handleWebhook(
            @RequestBody Map<String, Object> payload
            ){
        paymentService.handleWebhook(payload);
        return ResponseEntity.ok("Webhook processed");
    }
}
