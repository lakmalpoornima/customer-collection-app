import Dexie from 'dexie'

export const db = new Dexie('CustomerCollectionDB')

db.version(1).stores({
  customers: '++id, customerCode, name, phone, status, createdAt',
  customerRates: '++id, customerId, effectiveFrom',
  monthlyDues: '++id, customerId, monthKey, [customerId+monthKey]',
  collections: '++id, receiptNo, customerId, paymentDate, paymentSource, status, reconciliationId',
  paymentAllocations: '++id, collectionId, customerId, dueId',
  companyReconciliations: '++id, reconciliationNo, visitDate',
  directPaymentClaims: '++id, customerId, claimedDate, status',
  staffRecipients: '++id, name, status',
  cashHandovers: '++id, handoverNo, recipientId, handoverDate, status',
  cashbook: '++id, transactionNo, transactionType, transactionDate, referenceId',
  settings: '++id, key',
  auditLogs: '++id, entityType, entityId, action, createdAt',
})

db.version(2).stores({
  customers: '++id, customerCode, name, phone, status, createdAt',
  customerRates: '++id, customerId, effectiveFrom',
  monthlyDues: '++id, customerId, monthKey, [customerId+monthKey]',
  collections: '++id, receiptNo, customerId, paymentDate, paymentSource, status, reconciliationId',
  paymentAllocations: '++id, collectionId, customerId, dueId',
  companyReconciliations: '++id, reconciliationNo, visitDate',
  directPaymentClaims: '++id, customerId, claimedDate, status',
  staffRecipients: '++id, name, status',
  cashHandovers: '++id, handoverNo, recipientId, handoverDate, status',
  cashbook: '++id, transactionNo, transactionType, transactionDate, referenceId',
  settings: '++id, key',
  auditLogs: '++id, entityType, entityId, action, createdAt',
  advanceBalances: '++id, customerId, transactionDate, transactionType, referenceId',
})


db.version(3).stores({
  customers: '++id, customerCode, name, phone, status, createdAt',
  customerRates: '++id, customerId, effectiveFrom',
  monthlyDues: '++id, customerId, monthKey, [customerId+monthKey]',
  collections: '++id, receiptNo, customerId, paymentDate, paymentSource, status, reconciliationId',
  paymentAllocations: '++id, collectionId, customerId, dueId',
  companyReconciliations: '++id, reconciliationNo, visitDate',
  directPaymentClaims: '++id, customerId, claimedDate, status',
  staffRecipients: '++id, name, status',
  cashHandovers: '++id, handoverNo, recipientId, handoverDate, status',
  cashbook: '++id, transactionNo, transactionType, transactionDate, referenceId',
  settings: '++id, key',
  auditLogs: '++id, entityType, entityId, action, createdAt',
  advanceBalances: '++id, customerId, transactionDate, transactionType, referenceId',
})



db.version(4).stores({
  customers: '++id, customerCode, name, phone, status, createdAt',
  customerRates: '++id, customerId, effectiveFrom',
  monthlyDues: '++id, customerId, monthKey, [customerId+monthKey]',
  collections: '++id, receiptNo, customerId, paymentDate, paymentSource, status, reconciliationId',
  paymentAllocations: '++id, collectionId, customerId, dueId',
  companyReconciliations: '++id, reconciliationNo, visitDate',
  directPaymentClaims: '++id, customerId, claimedDate, status',
  staffRecipients: '++id, name, status',
  cashHandovers: '++id, handoverNo, recipientId, handoverDate, status',
  cashbook: '++id, transactionNo, transactionType, transactionDate, referenceId',
  settings: '++id, key',
  auditLogs: '++id, entityType, entityId, action, createdAt',
  advanceBalances: '++id, customerId, transactionDate, transactionType, referenceId',
  visits: '++id, customerId, visitDate, outcome, createdAt',
})
