# Northstar Bank Frontend

Responsive dark-themed React/Vite dashboard for exploring the Digital Banking System microservices locally. See the [root README](../README.md) for architecture, backend services, API details, and Docker Compose setup.

## Features

- Account lookup and account creation through Account Service
- Balance overview and recent transfer activity
- Activity history for both sent and received transfers
- Overview chart filters for 24 hours, 7 days, 30 days, and all time; expand up to 30 activities inline
- Account-to-account transfers with automatic status checks and email OTP verification when fraud screening flags activity
- Razorpay test order creation, hosted Checkout, and backend signature verification
- Live health checks for the API Gateway and all five application services
- Responsive desktop sidebar and mobile navigation

## Run locally

Start the backend from the repository root:

```bash
docker compose up --build -d
```

Then start Vite:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Vite proxies `/api` requests to the gateway on port `8080`, and service health checks to ports `8080`–`8085`. If a transfer requires OTP verification, the Transfer page will display the code form when the transaction reaches `PENDING_VERIFICATION`. Open the local Mailpit inbox at `http://localhost:8025` to retrieve the email code.

The UI is a local demonstration interface, not an authentication system. Use fictional contact information and test accounts only. Health checks and account/transfer features work independently of Razorpay. To use Razorpay Checkout, configure valid Razorpay **test** credentials for the Payment Service; the secret key must stay on the backend and must never be placed in frontend environment variables or source code.

## Build

```bash
npm run build
```

## API calls used

| Service | Operations |
|---|---|
| API Gateway | Health check and routing |
| Account Service | Create account, account lookup, balance |
| Transaction Service | Transfer, transaction history/status, OTP verification |
| Payment Service | Create Razorpay order and verify checkout signature |
| Fraud Detection Service | Health checks and event-driven transfer screening |
| Notification Service | Health checks and event-driven local notifications |

Fraud detection and notifications are driven by Kafka events rather than direct browser requests. Mailpit captures local OTP email for inspection; it does not send mail to real inboxes.
