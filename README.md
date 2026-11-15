<div align="center">

# Digital Banking System

**A Spring Boot microservices application for accounts, transfers, fraud checks, and payments.**

[![Java](https://img.shields.io/badge/Java-17-ED8B00?logo=openjdk&logoColor=white)](https://www.java.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4.1.2-6DB33F?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

### [Open the live application](http://13.239.36.115:8080)

**Gateway:** `http://13.239.36.115:8080` &nbsp;|&nbsp; **Health:** [`/actuator/health`](http://13.239.36.115:8080/actuator/health)

</div>

> **Deployment:** AWS ECR and EC2, as reported by the project owner. The URL above is the public gateway address. No frontend or API documentation UI is included in this repository.

## Contents

- [At a glance](#at-a-glance)
- [Architecture & request flow](#architecture--request-flow)
- [Services & project structure](#services--project-structure)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Data & messaging](#data--messaging)
- [Health & tests](#health--tests)
- [Troubleshooting & limitations](#troubleshooting--limitations)
- [Future improvements](#future-improvements)
- [License & security](#license--security)

## At a glance

| | |
|---|---|
| **Purpose** | Account management, internal transfers, fraud checks, and Razorpay order creation |
| **Public gateway** | [`http://13.239.36.115:8080`](http://13.239.36.115:8080) |
| **API base path** | `/api/v1` |
| **Services** | API Gateway, Account, Transaction, Payment, Fraud Detection, Notification |
| **Local infrastructure** | MySQL, Kafka/Zookeeper, Redis via Docker Compose |

### Features

| Capability | What it does |
|---|---|
| **Accounts** | Create and query accounts, view balances, and block accounts |
| **Transfers** | Initiate transfers, view history, and verify with OTP |
| **Fraud checks** | Check transaction velocity, unusual amounts, and balance thresholds |
| **Payments** | Create Razorpay payment orders |
| **Events** | Coordinate workflows over Kafka; log notifications |
| **Gateway** | Route APIs and apply Redis-backed IP rate limits |

## Architecture & request flow

```mermaid
flowchart LR
    C[Client] --> G[API Gateway :8080]
    G --> A[Account :8081]
    G --> T[Transaction :8082]
    G --> P[Payment :8083]
    T -->|Feign balance calls| A
    T <--> K[(Kafka)]
    F[Fraud Detection :8084] <--> K
    K --> N[Notification :8085]
    K --> A
    T --> R[(Redis)]
    F --> R
    G --> R
    A --> DA[(MySQL accounts)]
    T --> DT[(MySQL transactions)]
    P --> DP[(MySQL payments)]
    P --> K
    P --> RP[Razorpay]
```

### Transfer workflow

1. Gateway forwards the transfer request to Transaction Service and applies its route rate limit.
2. Transaction Service synchronously deducts the sender balance through Account Service, stores a `PROCESSING` transaction, and publishes `transaction.initiated`.
3. Fraud Detection checks the transaction and publishes either `fraud.check.clean` or `verification.required`.
4. A clean transaction is marked `COMPLETED`; `transaction.completed` causes Account Service to credit the receiver.
5. A suspicious transaction requires OTP verification. The OTP is stored in Redis for five minutes. A valid OTP completes the transfer; an expired or incorrect OTP causes a sender refund. An incorrect OTP also triggers an account block event.
6. Notification Service consumes events and writes notification content to application logs.

The flow is asynchronous after transfer initiation and uses compensating actions rather than a distributed database transaction. A newly created transfer can initially return with status `PROCESSING`.

## Services & project structure

| Directory | Role | Port |
|---|---|---:|
| `api-gateway/` | Routes account, transaction, and payment APIs; applies rate limits | 8080 |
| `account-service/` | Account records and balance operations | 8081 |
| `transaction-service/` | Transfers, transaction history, and OTP workflow | 8082 |
| `payment-service/` | Razorpay order creation and payment records | 8083 |
| `fraud-detection-service/` | Kafka-driven transaction checks | 8084 |
| `notification-service/` | Kafka consumers that log notifications | 8085 |
| `docker-compose.yml` | Local MySQL, Redis, Kafka, and Zookeeper | — |

Each service is an independent Maven project with `src/main/java`, `src/main/resources`, and `src/test/java`. Packages contain the service's controllers, services, repositories, entities, DTOs, clients, events, or configuration as needed.

## Technology

| Area | Stack |
|---|---|
| Language/runtime | Java 17 |
| Frameworks | Spring Boot 4.1.2, Spring Cloud 2025.1.4, Spring MVC, Spring Cloud Gateway |
| Persistence | Spring Data JPA, MySQL 8.0 |
| Messaging/cache | Apache Kafka with Zookeeper, Redis |
| Integrations | OpenFeign, Razorpay Java SDK 1.4.9 |
| Build/test | Maven Wrapper, JUnit / Spring Boot test dependencies |
| Local infrastructure | Docker Compose |

## Run locally

### Prerequisites

- JDK 17
- Docker Engine and Docker Compose
- Internet access for the first Maven Wrapper dependency download
- Razorpay test credentials if running Payment Service against Razorpay

### Start infrastructure

From the repository root:

```bash
docker compose up -d
```

Compose exposes MySQL on host port `3307`, Redis on `6379`, and Kafka on `9092`. It starts infrastructure only, not the Java services.

### Start services

Start each service in its own terminal:

| Service | From repository root (Linux/macOS) |
|---|---|
| Account | `cd account-service && ./mvnw spring-boot:run` |
| Transaction | `cd transaction-service && ./mvnw spring-boot:run` |
| Fraud Detection | `cd fraud-detection-service && ./mvnw spring-boot:run` |
| Notification | `cd notification-service && ./mvnw spring-boot:run` |
| API Gateway | `cd api-gateway && ./mvnw spring-boot:run` |
| Payment | `cd payment-service && ./mvnw spring-boot:run` |

On Windows, use `cd <service-folder>` followed by `.\mvnw.cmd spring-boot:run`. Configure valid Razorpay credentials before starting Payment Service; see [Configuration](#configuration) and [Troubleshooting & limitations](#troubleshooting--limitations). Stop local infrastructure with `docker compose down`.

## Configuration

Each module has `src/main/resources/application.yaml` and an `example.application.yaml`. Spring Boot properties may be overridden with environment variables or command-line options. The repository has no root `.env` loader.

| Configuration | Defaults / notes |
|---|---|
| Ports | Gateway `8080`; services `8081`–`8085` as listed above |
| MySQL | Local host port `3307`; separate databases `dbs_account_db`, `dbs_transaction_db`, `dbs_payment_db` |
| Redis | `localhost:6379`; Gateway supports `REDIS_HOST` |
| Account service URL | `ACCOUNT_SERVICE_URL`, default `http://localhost:8081` |
| Gateway backend URLs | `TRANSACTION_SERVICE_URL` defaults to `http://localhost:8082`; `PAYMENT_SERVICE_URL` defaults to `http://localhost:8083` |
| Fraud thresholds | `fraud.max-transactions-per-minute: 5`; `fraud.suspicious-amount-multiplier: 5`; `fraud.max-balance-percentage: 0.90` |
| Razorpay | `razorpay.key-id`, `razorpay.key-secret`, `razorpay.webhook-secret`; provide credentials using a secure environment-specific configuration |

For local MySQL overrides, standard Spring properties include `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, and `SPRING_DATASOURCE_PASSWORD`. Razorpay key properties can be overridden with `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. Never commit real credentials.

## API reference

The Gateway routes the API paths below. The base URL is `http://13.239.36.115:8080` when using the public deployment, or `http://localhost:8080` locally. Requests/responses use JSON unless indicated.

| Method | Path | Purpose and input |
|---|---|---|
| `POST` | `/api/v1/accounts` | Create account. JSON fields: `accountHolderName`, `email`, `phone`, `accountType` (`SAVING`, `CURRENT`, `FIXED_DEPOSIT`), `initialDeposit`. |
| `GET` | `/api/v1/accounts/{accountNumber}` | Get account details. |
| `GET` | `/api/v1/accounts/{accountNumber}/balance` | Get balance. |
| `PUT` | `/api/v1/accounts/{accountNumber}/block` | Block account. |
| `PUT` | `/api/v1/accounts/{accountNumber}/deduct?amount={amount}` | Deduct balance; used by transaction workflow. |
| `PUT` | `/api/v1/accounts/{accountNumber}/credit?amount={amount}` | Credit balance; used by transaction workflow. |
| `POST` | `/api/v1/transactions/transfer` | Start transfer. JSON: `senderAccountNumber`, `receiverAccountNumber`, positive `amount`, optional `description`. |
| `GET` | `/api/v1/transactions/{transactionId}` | Get transaction and current status. |
| `GET` | `/api/v1/transactions/account/{accountNumber}` | List transactions sent from this account, newest first. |
| `POST` | `/api/v1/transactions/{transactionId}/verify?otp={otp}` | Verify a pending transaction with its six-digit OTP. |
| `POST` | `/api/v1/payments/create-order` | Create a Razorpay order. JSON: `accountNumber`, positive `amount`, optional `description`. |

### Example: create an account

```bash
curl -X POST http://localhost:8080/api/v1/accounts \
  -H 'Content-Type: application/json' \
  -d '{"accountHolderName":"Alex Example","email":"alex@example.test","phone":"5550100","accountType":"SAVING","initialDeposit":1000.00}'
```

The response includes the generated `accountNumber`, account status, balance, and daily transaction limit. Replace `localhost:8080` with the [public gateway](http://13.239.36.115:8080) to target the deployment. Avoid sending test or personal data to a public deployment unless authorized.

### Example: initiate a transfer

```bash
curl -X POST http://localhost:8080/api/v1/transactions/transfer \
  -H 'Content-Type: application/json' \
  -d '{"senderAccountNumber":"<sender>","receiverAccountNumber":"<receiver>","amount":25.00,"description":"Example transfer"}'
```

The response includes a transaction `id`, `referenceNumber`, and initial status. Query `GET /api/v1/transactions/{transactionId}` to check its later status.

## Data & messaging

### MySQL entities

| Table | Stored fields (overview) |
|---|---|
| `accounts` | Account number, holder contact details, account type/status, balance, daily limit, timestamps |
| `transactions` | Sender/receiver numbers, amount, type/status, description, failure reason, reference, timestamps |
| `payments` | Account number, amount/currency/status, Razorpay IDs, description, failure reason, timestamps |

The account and transaction services configure Hibernate `ddl-auto: update`. No database migration files are included.

### Kafka and Redis

Kafka topics used by service code: `transaction.initiated`, `fraud.check.clean`, `verification.required`, `transaction.otp.generated`, `transaction.completed`, `transaction.refunded`, `fraud.detected`, `payment.completed`, and `payment.failed`. Local Compose enables automatic topic creation.

Redis holds Gateway rate-limit state, fraud velocity and average-amount values, and OTPs with a five-minute expiry. No dead-letter queue or schema registry is configured.

## Health & tests

Actuator health and info endpoints are configured across services; the Gateway additionally exposes gateway actuator data:

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8081/actuator/health
```

Run a module's tests from its directory:

```bash
./mvnw test
```

On Windows use `.\mvnw.cmd test`. The modules include Spring application context-load tests; some require their configured infrastructure (such as MySQL) to be available.

## Troubleshooting & limitations

| Symptom | Check |
|---|---|
| MySQL, Kafka, or Redis connection refused | Run `docker compose ps`; inspect container logs and ports `3307`, `9092`, `6379`. |
| Database authentication/connection error | Compare the service JDBC configuration with the local MySQL setup. The Compose MySQL volume persists across restarts. |
| Gateway returns `503` | Verify target services and Redis. Gateway rate limits are 10 requests/second (burst 20) for account/transaction routes and 5/second (burst 10) for payment routes, by remote IP. |
| Transfer stays `PROCESSING` | Check Kafka consumer logs and query the transaction again. Suspicious transactions require OTP verification. |
| Payment startup or provider calls fail | Supply valid Razorpay test credentials and review the configuration caveats below. |

**Implementation caveats**

- Local Compose is a development setup: single-node Kafka and MySQL root access; it is not production-hardened.
- The Gateway has no authentication configured. Do not expose account/balance operations to untrusted users.
- Notification consumers write message content to application logs. Email delivery is not implemented despite mail dependencies.
- Payment configuration currently nests JPA and Kafka properties under `spring.datasource` instead of as sibling `spring.jpa` and `spring.kafka` properties. The payment broker address also differs from the Compose advertised addresses; verify/correct both before running that service locally.
- Payment webhook handler has no HTTP route annotation, and the configured webhook secret is not validated.
- Payment creation requests `USD` but converts the amount to minor units by multiplying by 100. Verify currency/amount handling before real use.
- Daily transaction limits are stored but are not enforced by transfer logic.
- OTPs are included in application notification logs. Do not use real financial or personal data in development.

## Future improvements

- Add authentication/authorization, safer service-to-service access, and production deployment hardening.
- Move secrets to a managed secret store and standardize service configuration.
- Add database migrations, event idempotency, retries/dead-letter handling, and saga recovery.
- Implement and secure a mapped Razorpay webhook with signature verification.
- Add end-to-end integration tests for transfer, fraud, payment, and notification flows.

## License & security

This project is licensed under the [MIT License](LICENSE). The license does not grant rights to third-party services, credentials, or infrastructure. The application is a development project, not a certified banking platform; review the security model and payment behavior before public or financial use.
