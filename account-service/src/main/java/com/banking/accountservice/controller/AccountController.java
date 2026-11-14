package com.banking.accountservice.controller;

import com.banking.accountservice.dto.AccountResponse;
import com.banking.accountservice.dto.CreateAccountRequest;
import com.banking.accountservice.service.AccountService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/v1/accounts")
@Slf4j
@RequiredArgsConstructor
public class AccountController {

    private final AccountService service;

    // Create new bank account
    @PostMapping
    public ResponseEntity<AccountResponse> createAccount(
            @Valid @RequestBody CreateAccountRequest request
            ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.createAccount(request));
    }

    // Get account details
    @GetMapping("/{accountNumber}")
    public ResponseEntity<AccountResponse> getAccount(
            @PathVariable String accountNumber
            ) {
        return ResponseEntity.ok(service.getAccount(accountNumber));
    }

    // Get account balance
    @GetMapping("/{accountNumber}/balance")
    public ResponseEntity<BigDecimal> getBalance(
            @PathVariable String accountNumber
            ) {
        return ResponseEntity.ok(service.getBalance(accountNumber));
    }

    // Block Account
    @PutMapping("/{accountNumber}/block")
    public ResponseEntity<String> blockAccount(
            @PathVariable String accountNumber
            ) {
        service.blockAccount(accountNumber);
        return ResponseEntity.ok("Account blocked successfully");
    }

    /**
     * SAGA STEP:1 - Deduct Balance
     * Called by the transition service when a transfer is initiated.
     */
    @PutMapping("/{accountNumber}/deduct")
    public ResponseEntity<String> deductBalance(
            @PathVariable String accountNumber,
            @RequestParam BigDecimal amount
            ) {
        service.deductBalance(accountNumber, amount);
        return ResponseEntity.ok("Balance deducted successfully");
    }

    /**
     * SAGA STEP:4 - Credit Balance
     * Called by transition service in two scenarios:
     * 1. Fraud detection -> refund sender (under step 1)
     * 2. Transition completed -> credit receiver
     */
    @PutMapping("/{accountNumber}/credit")
    public ResponseEntity<String> creditBalance(
            @PathVariable String accountNumber,
            @RequestParam BigDecimal amount
            ) {
        service.creditBalance(accountNumber, amount);
        return ResponseEntity.ok("Balance credited successfully");
    }
}
