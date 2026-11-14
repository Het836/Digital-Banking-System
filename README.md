# Digital Banking System

## Introduction

A Java/Spring Boot microservices project for account management, internal transfers, fraud checks, and Razorpay order creation. A live deployment URL is **not available** in the repository.

## Project Overview

The API Gateway routes client requests to account, transaction, and payment services. Account, transaction, and payment records are stored in separate MySQL databases. Kafka carries transaction and payment events between services; Redis supports rate limiting, fraud counters, and short-lived OTPs. The transaction workflow uses synchronous account balance calls and Kafka-driven fraud decisions.

## Key Features

- Create and query accounts and balances; block accounts and adjust balances.
- Initiate transfers, view transaction details/history, and verify transactions with an OTP.
- Run configurable velocity, amount, and balance-threshold fraud checks.
- Create Razorpay payment orders and process payment outcomes through the payment service logic.
- Route APIs through Spring Cloud Gateway with Redis-backed per-IP rate limits.
- Publish notifications to application logs for transaction, fraud, OTP, and payment events.

## Table of Contents

- [Architecture, Request Flow & Workflow](#architecture-request-flow--workflow)
- [Services & Project Structure](#services--project-structure)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Installation & Setup](#installation--setup)
- [How to Run](#how-to-run)
- [API & Endpoint Reference](#api--endpoint-reference)
- [Database & Messaging](#database--messaging)
- [Health Checks & Testing](#health-checks--testing)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Notes](#notes)
- [Policies & License](#policies--license)

## Architecture, Request Flow & Workflow

### High-level design

```text
Client
  |
  v
API Gateway (:8080) -- Redis (rate limits)
  |          |           |
  v          v           v
Accounts   Transactions  Payments
(:8081)     (:8082)      (:8083)
  |          |  \          |
  +----------+   +-- Kafka -+
                 |          |
            Fraud checks  Notifications
              (:8084)      (:8085)
```

MySQL and Redis are shared infrastructure, with separate MySQL databases for accounts, transactions, and payments. Fraud detection and notifications consume Kafka events; only the gateway and the three API services expose documented application APIs.

### Transfer request flow

1. The gateway applies an IP-based rate limit and routes the transfer request to the transaction service.
2. The transaction service asks the account service to deduct the sender's balance, saves a `PROCESSING` transaction, then publishes `transaction.initiated`.
3. Fraud detection checks transaction velocity, amount relative to its Redis-stored running average, and amount relative to current account balance.
4. A clean result publishes `fraud.check.clean`; the transaction service marks the transaction `COMPLETED` and publishes `transaction.completed`. The account service credits the receiver.
5. A suspicious result publishes `verification.required`; the transaction service stores an OTP in Redis for five minutes and publishes `transaction.otp.generated`. The OTP verification API completes the transfer when valid, or refunds the sender when expired/incorrect. An incorrect OTP also publishes `fraud.detected` to block the sender's account.
6. Notification consumers log alerts for applicable events.

This is a saga-style workflow, not a distributed database transaction. A successful transfer response may initially have status `PROCESSING`; check the transaction again for its eventual status.

## Services & Project Structure

| Directory | Responsibility | Default port |
|---|---|---:|
| `api-gateway/` | Routes account, transaction, and payment APIs; applies rate limits | 8080 |
| `account-service/` | Account records, balance operations, account event consumer | 8081 |
| `transaction-service/` | Transfer API, transaction records, OTP workflow | 8082 |
| `payment-service/` | Razorpay order creation and payment persistence | 8083 |
| `fraud-detection-service/` | Kafka-driven fraud checks | 8084 |
| `notification-service/` | Kafka-driven notification logging | 8085 |
| `docker-compose.yml` | MySQL, Redis, Zookeeper, and Kafka infrastructure | See below |

Each service is a standalone Maven/Spring Boot project with `src/main/java`, `src/main/resources`, and `src/test/java`. Java packages are organized into controllers, services, repositories, entities, DTOs, clients, events, and configuration as applicable.

## Tech Stack

- Java 17 and Maven (Maven Wrapper included in each service)
- Spring Boot 4.1.2; Spring Cloud 2025.1.4 in gateway and services that use OpenFeign
- Spring MVC, Spring Cloud Gateway, Spring Data JPA, OpenFeign, and Spring Actuator
- MySQL 8.0, Redis, Apache Kafka, and Zookeeper
- Razorpay Java SDK 1.4.9, Jackson, Jakarta Validation, and Lombok
- Docker Compose for local infrastructure

## Prerequisites

- JDK 17
- Docker Engine with Docker Compose
- Network access to Maven Central on the first Maven Wrapper run
- Razorpay test credentials to create real Razorpay orders
- `curl` (examples below use `curl.exe` in PowerShell)

## Configuration

Service configuration is in each `src/main/resources/application.yaml`; an `example.application.yaml` is also present in each module. Spring Boot environment variables and command-line properties can override configuration. Do not commit credentials or production secrets.

| Setting | Services | Configured default / behavior |
|---|---|---|
| Service ports | All | Gateway `8080`, account `8081`, transaction `8082`, payment `8083`, fraud `8084`, notification `8085` |
| MySQL | Account, transaction, payment | Host port `3307`; databases `dbs_account_db`, `dbs_transaction_db`, `dbs_payment_db`; each application config contains local development credentials |
| Kafka | Account, transaction, fraud, notification, payment | Compose exposes host port `9092`; payment service has a separate broker setting—see [Notes](#notes) |
| Redis | Gateway, transaction, fraud | Host `localhost`, port `6379`; gateway supports `REDIS_HOST` |
| Account service URL | Transaction, fraud, gateway | `ACCOUNT_SERVICE_URL`, default `http://localhost:8081` |
| Gateway backend URLs | Gateway | `TRANSACTION_SERVICE_URL` defaults to `http://localhost:8082`; `PAYMENT_SERVICE_URL` defaults to `http://localhost:8083` |
| Fraud thresholds | Fraud service | `fraud.max-transactions-per-minute: 5`, `fraud.suspicious-amount-multiplier: 5`, `fraud.max-balance-percentage: 0.90` |
| Razorpay | Payment service | `razorpay.key-id`, `razorpay.key-secret`, `razorpay.webhook-secret`; supply your own test credentials via Spring configuration overrides |

Spring Boot property overrides can be supplied as environment variables, for example `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD`, `RAZORPAY_KEY_ID`, and `RAZORPAY_KEY_SECRET`. These are standard Spring Boot property mappings; the repository does not provide a root `.env` loader.

## Installation & Setup

From the repository root, start the infrastructure:

```powershell
docker compose up -d
```

This starts Redis on `6379`, MySQL on host port `3307`, and Kafka on `9092` with Zookeeper. The Compose file starts infrastructure only, not the Java services. Each service creates/updates its schema through JPA configuration where configured.

Before starting the payment service, provide valid Razorpay credentials and review the payment configuration caveats in [Notes](#notes). Start each service from its own terminal as shown below.

## How to Run

From the repository root, run one command per terminal:

```powershell
cd account-service
.\mvnw.cmd spring-boot:run
```

```powershell
cd transaction-service
.\mvnw.cmd spring-boot:run
```

```powershell
cd fraud-detection-service
.\mvnw.cmd spring-boot:run
```

```powershell
cd notification-service
.\mvnw.cmd spring-boot:run
```

```powershell
cd api-gateway
.\mvnw.cmd spring-boot:run
```

```powershell
cd payment-service
.\mvnw.cmd spring-boot:run
```

Use the gateway at `http://localhost:8080` for account, transaction, and payment routes. Services can also be called directly on their ports. Stop infrastructure with `docker compose down`; the MySQL data volume persists unless explicitly removed.

## API & Endpoint Reference

All API paths are rooted under `/api/v1`. Requests and responses use JSON unless noted. Gateway routes are configured for account, transaction, and payment path prefixes. No authentication is configured.

| Method | Path | Purpose / parameters |
|---|---|---|
| `POST` | `/api/v1/accounts` | Create account. Body: `accountHolderName`, `email`, `phone`, `accountType` (`SAVING`, `CURRENT`, `FIXED_DEPOSIT`), `initialDeposit`. |
| `GET` | `/api/v1/accounts/{accountNumber}` | Get account details. |
| `GET` | `/api/v1/accounts/{accountNumber}/balance` | Get balance. |
| `PUT` | `/api/v1/accounts/{accountNumber}/block` | Block account. |
| `PUT` | `/api/v1/accounts/{accountNumber}/deduct?amount={amount}` | Deduct balance; used by transaction workflow. |
| `PUT` | `/api/v1/accounts/{accountNumber}/credit?amount={amount}` | Credit balance; used by transaction workflow. |
| `POST` | `/api/v1/transactions/transfer` | Start transfer. Body: `senderAccountNumber`, `receiverAccountNumber`, positive `amount`, optional `description`. |
| `GET` | `/api/v1/transactions/{transactionId}` | Get transaction status and details. |
| `GET` | `/api/v1/transactions/account/{accountNumber}` | Get transactions sent from this account, newest first. |
| `POST` | `/api/v1/transactions/{transactionId}/verify?otp={otp}` | Verify a pending transaction using the six-digit OTP delivered through the notification consumer. |
| `POST` | `/api/v1/payments/create-order` | Create Razorpay order. Body: `accountNumber`, positive `amount`, optional `description`. |

### Example requests

Create an account:

```powershell
curl.exe -X POST http://localhost:8080/api/v1/accounts `
  -H "Content-Type: application/json" `
  -d '{"accountHolderName":"Alex Example","email":"alex@example.test","phone":"5550100","accountType":"SAVING","initialDeposit":1000.00}'
```

The response contains the generated `accountNumber`, account status, balance, and daily transaction limit.

Start a transfer (replace the account-number placeholders with accounts created through the API):

```powershell
curl.exe -X POST http://localhost:8080/api/v1/transactions/transfer `
  -H "Content-Type: application/json" `
  -d '{"senderAccountNumber":"<sender>","receiverAccountNumber":"<receiver>","amount":25.00,"description":"Example transfer"}'
```

The response includes the generated transaction `id`, `referenceNumber`, and initial status (normally `PROCESSING`). Query `GET /api/v1/transactions/{transactionId}` for subsequent status.

Create a payment order:

```powershell
curl.exe -X POST http://localhost:8080/api/v1/payments/create-order `
  -H "Content-Type: application/json" `
  -d '{"accountNumber":"<account>","amount":25.00,"description":"Example payment"}'
```

The order response includes `paymentId`, `razorpayOrderId`, `amount`, `currency`, `razorpayKeyId`, and status. Exact provider responses depend on configured Razorpay credentials. The payment webhook handler currently has no HTTP mapping; see [Notes](#notes).

## Database & Messaging

### Database

MySQL data is split across three databases. JPA entities define the `accounts`, `transactions`, and `payments` tables; the account and transaction services configure Hibernate `ddl-auto: update`. No standalone migration scripts or relational schema files are included.

- **Accounts:** account number, holder contact details, account type/status, balance, daily transaction limit, timestamps.
- **Transactions:** sender and receiver account numbers, amount, type/status, description, failure reason, reference number, timestamps.
- **Payments:** account number, amount/currency/status, Razorpay order/payment IDs, description, failure reason, timestamps.

### Kafka and Redis

Kafka topics used by the implementation include `transaction.initiated`, `fraud.check.clean`, `verification.required`, `transaction.otp.generated`, `transaction.completed`, `transaction.refunded`, `fraud.detected`, `payment.completed`, and `payment.failed`. Kafka auto topic creation is enabled in the local Compose configuration.

Redis stores gateway rate-limit state, fraud velocity and average-amount values, and OTPs with a five-minute expiry. No external message queue, dead-letter topic, or schema registry is configured.

## Health Checks & Testing

Actuator exposes `/actuator/health` and `/actuator/info` for services configured with those endpoints. The gateway additionally exposes gateway actuator data. Examples:

```powershell
curl.exe http://localhost:8080/actuator/health
curl.exe http://localhost:8081/actuator/health
```

Run tests from a service directory:

```powershell
.\mvnw.cmd test
```

Each module contains a Spring application context-load test. Services that require MySQL may need the local infrastructure running for their test context to start.

## Troubleshooting

- **Connection refused to MySQL, Kafka, or Redis:** Check `docker compose ps`, container logs, and host ports `3307`, `9092`, and `6379`.
- **Database connection/authentication failure:** Ensure the service JDBC URL and credentials match the local MySQL setup. The Compose MySQL data volume retains its initialized root password.
- **Account/transaction services cannot call each other:** Verify `ACCOUNT_SERVICE_URL` points to the account service and that the account service is listening on the configured port.
- **Gateway returns 503 or rate-limit errors:** Confirm backend services and Redis are running. Gateway rate limits are 10 requests/second with burst 20 for account/transaction APIs and 5/second with burst 10 for payment APIs, keyed by remote IP.
- **Payment service cannot connect to Kafka or Razorpay:** Review the payment configuration caveats and use valid test credentials. Compose advertises Kafka for host clients at `localhost:9092` and internal clients at `kafka:29092`.
- **Transfer remains `PROCESSING`:** Check Kafka consumer logs for fraud service and transaction service, then verify the matching transaction status. Suspicious transactions require OTP verification.

## Future Improvements

- Add authentication, authorization, API-level validation, and secure service-to-service access.
- Move credentials to a secret manager and standardize service configuration.
- Add database migrations, idempotent event handling, retry/dead-letter handling, and saga recovery.
- Complete and secure Razorpay webhook handling, including signature verification and an explicit HTTP route.
- Add integration tests for transfer, fraud, payment, and notification workflows.

## Notes

- The Compose configuration is for local development and uses single-node Kafka and a MySQL root account; it is not production-hardened.
- Some account balance operations are exposed as HTTP endpoints and are not protected by authentication. Do not expose this setup to untrusted networks.
- Notification delivery currently writes messages to application logs; SMTP-related dependencies do not mean email delivery is implemented.
- The payment service configuration files place JPA and Kafka settings beneath `spring.datasource`, rather than as sibling `spring.jpa` and `spring.kafka` properties. Review/correct this structure for local runtime use. The payment broker setting also differs from the Compose host/internal advertised listener addresses.
- The payment webhook handler method is not annotated with a route, and the configured webhook secret is not used by the implementation.
- Payment creation sends currency `USD` while converting the supplied amount to minor units as if it were a two-decimal currency. Verify and correct this before handling real payments.
- `dailyTransactionLimit` is assigned when an account is created, but transfer logic does not enforce that limit.
- OTP and notification contents are logged; avoid production data and real secrets in local testing.

## Policies & License

No usage policy or license file is included; license information is **not specified**. Treat the project as unlicensed unless the owner provides terms. Security controls and production deployment guidance are not specified; use test credentials, keep services on trusted networks, and do not process real financial or personal data without a security review.
