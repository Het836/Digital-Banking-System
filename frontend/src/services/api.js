import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const createAccount = (data) => api.post('/api/v1/accounts', data);
export const getAccount = (accountNumber) => api.get(`/api/v1/accounts/${accountNumber}`);
export const getBalance = (accountNumber) => api.get(`/api/v1/accounts/${accountNumber}/balance`);

export const transfer = (data) => api.post('/api/v1/transactions/transfer', data);
export const getTransaction = (transactionId) => api.get(`/api/v1/transactions/${transactionId}`);
export const getTransactionHistory = (accountNumber) => api.get(`/api/v1/transactions/account/${accountNumber}`);
export const verifyTransaction = (transactionId, otp) =>
  api.post(`/api/v1/transactions/${transactionId}/verify`, null, { params: { otp } });

export const createPaymentOrder = (data) => api.post('/api/v1/payments/create-order', data);
export const verifyPayment = (data) => api.post('/api/v1/payments/verify', data);

export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error.response?.status === 429) {
    return 'Too many requests reached the API Gateway. Wait a moment, then try again.';
  }
  return error.response?.data?.message || error.response?.data?.error || error.message || fallback;
};

export const checkServiceHealth = (serviceName) =>
  api.get(`/service-health/${serviceName}`, { timeout: 5000 });
