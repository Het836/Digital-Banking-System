package com.banking.accountservice.service;

import com.banking.accountservice.dto.AccountResponse;
import com.banking.accountservice.dto.CreateAccountRequest;
import com.banking.accountservice.entity.Account;
import com.banking.accountservice.entity.AccountStatus;
import com.banking.accountservice.entity.AccountType;
import com.banking.accountservice.repository.AccountRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.security.SecureRandom;

@Service
@Slf4j
@RequiredArgsConstructor
public class AccountService {

    private final AccountRepository repository;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    // Create account
    public AccountResponse createAccount(CreateAccountRequest request){
        log.info("Creating account for email: {}", request.getEmail());

        if(repository.existsByEmail(request.getEmail())){
            throw new RuntimeException("Account already exists for this email: " + request.getEmail());
        }

        Account account = Account.builder()
                .accountHolderName(request.getAccountHolderName())
                .email(request.getEmail())
                .phone(request.getPhone())
                .accountType(request.getAccountType())
                .status(AccountStatus.ACTIVE)
                .balance(request.getInitialDeposit())
                .accountNumber(generateAccountNumber())
                .dailyTransactionLimit(
                        request.getAccountType() == AccountType.SAVING
                            ? new BigDecimal("100000")
                            : new BigDecimal("500000")
                )
                .build();

        Account saved =  repository.save(account);
        log.info("Account created: {}", saved.getAccountNumber());
        return mapToResponse(saved);
    }

    // Get account by account number.
    public AccountResponse getAccount(String accountNumber){
        Account account = repository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found for number: " + accountNumber));
        return mapToResponse(account);
    }

    // Get account balance by account number.
    public BigDecimal getBalance(String accountNumber){
        Account account = repository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found for number: " + accountNumber));
        return account.getBalance();
    }

    /**
     * Block account called by fraud detection service via Kafka.
     */
    public void blockAccount(String accountNumber){
        log.info("Blocking account: {}", accountNumber);
        Account account = repository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found for number: " + accountNumber));
        account.setStatus(AccountStatus.BLOCKED);
        repository.save(account);
        log.info("Account blocked: {}", accountNumber);
    }

    /**
     * Deduct balance from sender account.
     * Called by transaction service.
     */
    public void deductBalance(String accountNumber, BigDecimal amount) {
        log.info("Deducting balance from account: {}, current balance: {}", accountNumber, getBalance(accountNumber));
        Account account = repository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found for number: " + accountNumber));
        if (!account.getStatus().equals(AccountStatus.ACTIVE)) {
            throw new RuntimeException("Account is not active: " + accountNumber);
        }
        if (account.getBalance().compareTo(amount) < 0) {
            throw new RuntimeException("Insufficient funds: " + accountNumber);
        }
        account.setBalance(account.getBalance().subtract(amount));
        repository.save(account);
        log.info("Balance deducted from account: {}, new balance: {}", accountNumber, getBalance(accountNumber));
    }

    /**
     * Credit balance
     * Called by transaction service via Kafka
     */
    public void creditBalance(String accountNumber, BigDecimal amount) {
        log.info("Crediting balance to account: {}, current balance: {}", accountNumber, getBalance(accountNumber));
        Account account = repository.findByAccountNumber(accountNumber)
                .orElseThrow(() -> new RuntimeException("Account not found for number: " + accountNumber));
        if (!account.getStatus().equals(AccountStatus.ACTIVE)) {
            throw new RuntimeException("Account is not active: " + accountNumber);
        }
        account.setBalance(account.getBalance().add(amount));
        repository.save(account);
        log.info("Balance credited to account: {}, new balance: {}", accountNumber, getBalance(accountNumber));
    }

    // Generate 12-digit unique number.
    private String generateAccountNumber(){
        String accountNumber;

        do {
            long number = SECURE_RANDOM.nextLong(1_000_000_000L);

            accountNumber = String.format("%012d", number);
        } while (repository.existsByAccountNumber(accountNumber));

        return accountNumber;
    }

    private AccountResponse mapToResponse(Account account){
        return AccountResponse.builder()
                .id(account.getId())
                .accountNumber(account.getAccountNumber())
                .accountHolderName(account.getAccountHolderName())
                .email(account.getEmail())
                .phone(account.getPhone())
                .accountType(account.getAccountType())
                .status(account.getStatus())
                .balance(account.getBalance())
                .dailyTransactionLimit(account.getDailyTransactionLimit())
                .createdAt(account.getCreatedAt())
                .build();
    }
}
