package com.banking.transactionservice.entity;

/**
 * Transaction life cycle flow
 *
 * PENDING -> PROCESSING -> COMPLETED (clean transaction)
 *                       -> PENDING_VERFICATION (suspicious detected)
 *                                              -> COMPLETED (verified)
 *                                              -> FLAGGED (SAGA REFUND)
                         -> FAILED
                         -> FLAGGED
 */
public enum TranscationStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    PENDING_VERIFICATION,
    FLAGGED,
    FAILED
}
