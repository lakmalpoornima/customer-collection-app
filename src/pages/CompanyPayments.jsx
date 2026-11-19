
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Search,
  Building2,
  ClipboardList,
  CheckCircle,
  Clock,
  XCircle,
  User,
  CalendarDays,
  Receipt,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'

import { db } from '../database/db.js'
import '../styles/company-payments.css'

const today = () => {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 10)
}

const currency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB')
}

const generateNumber = (prefix, date) => {
  const datePart = date.replaceAll('-', '')
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `${prefix}-${datePart}-${randomPart}`
}

const getCustomerCode = (customer) =>
  customer.customerCode ||
  `CUS${String(customer.id).padStart(5, '0')}`

const getClaimedAmount = (claim) =>
  Number(claim.claimedAmount ?? claim.amount ?? 0)

const getVerifiedAmount = (claim) =>
  Number(claim.verifiedAmount || 0)

const getRemainingClaim = (claim) =>
  Math.max(0, getClaimedAmount(claim) - getVerifiedAmount(claim))

const getDueBalance = (due) => {
  if (due.balance !== undefined && due.balance !== null) {
    return Math.max(0, Number(due.balance))
  }

  return Math.max(
    0,
    Number(due.dueAmount || 0) - Number(due.paidAmount || 0),
  )
}

const claimStatusLabel = (status) => {
  const labels = {
    PENDING: 'Pending',
    PARTIAL: 'Partially Verified',
    VERIFIED: 'Verified',
    REJECTED: 'Rejected',
    PARTIAL_REJECTED: 'Partially Verified / Remainder Rejected',
  }

  return labels[status] || status || 'Unknown'
}

export default function CompanyPayments() {
  const [activeTab, setActiveTab] = useState('enter')
  const [search, setSearch] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [claimedDate, setClaimedDate] = useState(today())
  const [claimedAmount, setClaimedAmount] = useState('')
  const [companyReference, setCompanyReference] = useState('')
  const [claimNotes, setClaimNotes] = useState('')
  const [savingClaim, setSavingClaim] = useState(false)

  const [verificationDate, setVerificationDate] = useState(today())
  const [verificationAmounts, setVerificationAmounts] = useState({})
  const [verificationReferences, setVerificationReferences] = useState({})
  const [verificationNotes, setVerificationNotes] = useState({})
  const [savingClaimId, setSavingClaimId] = useState(null)

  const [historySearch, setHistorySearch] = useState('')
  const [historyFilter, setHistoryFilter] = useState('ALL')

  const customers =
    useLiveQuery(
      () => db.customers.where('status').equals('active').toArray(),
      [],
    ) || []

  const claims =
    useLiveQuery(
      () => db.directPaymentClaims.toArray(),
      [],
    ) || []

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  )

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === customerId,
  )

  const filteredCustomers = customers.filter((customer) => {
    const value = search.trim().toLowerCase()

    if (!value) return true

    return (
      String(customer.name || '').toLowerCase().includes(value) ||
      String(customer.phone || '').includes(value) ||
      String(customer.customerCode || '').toLowerCase().includes(value)
    )
  })

  const pendingClaims = useMemo(() => {
    return claims
      .filter(
        (claim) =>
          ['PENDING', 'PARTIAL'].includes(claim.status) &&
          getRemainingClaim(claim) > 0,
      )
      .sort((a, b) =>
        String(b.claimedDate || '').localeCompare(
          String(a.claimedDate || ''),
        ),
      )
  }, [claims])

  const historyClaims = useMemo(() => {
    return claims
      .filter((claim) => {
        const customer = customerMap.get(claim.customerId)
        const searchValue = historySearch.trim().toLowerCase()

        const matchesSearch =
          !searchValue ||
          String(customer?.name || claim.customerName || '')
            .toLowerCase()
            .includes(searchValue) ||
          String(claim.companyReference || '')
            .toLowerCase()
            .includes(searchValue)

        const matchesStatus =
          historyFilter === 'ALL' || claim.status === historyFilter

        return matchesSearch && matchesStatus
      })
      .sort((a, b) =>
        String(b.claimedDate || '').localeCompare(
          String(a.claimedDate || ''),
        ),
      )
  }, [claims, customerMap, historySearch, historyFilter])

  const pendingTotal = pendingClaims.reduce(
    (total, claim) => total + getRemainingClaim(claim),
    0,
  )

  const saveClaim = async (event) => {
    event.preventDefault()

    if (!selectedCustomer) {
      alert('Please select a customer.')
      return
    }

    const amount = Number(claimedAmount)

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Enter a valid payment amount.')
      return
    }

    if (!claimedDate) {
      alert('Select the date the customer made the company payment.')
      return
    }

    setSavingClaim(true)

    try {
      const createdAt = new Date().toISOString()

      const claimId = await db.directPaymentClaims.add({
        customerId: selectedCustomer.id,
        customerCode: getCustomerCode(selectedCustomer),
        customerName: selectedCustomer.name,

        claimedDate,
        claimedAmount: amount,
        verifiedAmount: 0,
        remainingAmount: amount,

        companyReference: companyReference.trim(),
        notes: claimNotes.trim(),

        status: 'PENDING',

        createdAt,
        updatedAt: createdAt,
      })

      await db.auditLogs.add({
        entityType: 'DIRECT_PAYMENT_CLAIM',
        entityId: claimId,
        action: 'DIRECT_PAYMENT_CLAIM_CREATED',
        createdAt,
      })

      alert(
        'Company payment claim recorded successfully.\n\nStatus: Pending Verification\n\nThe customer outstanding balance has NOT been reduced.',
      )

      setCustomerId('')
      setSearch('')
      setClaimedAmount('')
      setCompanyReference('')
      setClaimNotes('')
      setClaimedDate(today())
    } catch (error) {
      console.error('Company payment claim error:', error)
      alert(error.message || 'Unable to save company payment claim.')
    } finally {
      setSavingClaim(false)
    }
  }

  const updateVerificationInput = (claimId, value) => {
    setVerificationAmounts((previous) => ({
      ...previous,
      [claimId]: value,
    }))
  }


const verifyClaim = async (claim) => {
  setSavingClaimId(claim.id)

  let amountVerified = 0

  try {
    const verificationDate = today()
    const createdAt = new Date().toISOString()

    await db.transaction(
      'rw',
      [
        db.customers, // IMPORTANT: This was missing
        db.directPaymentClaims,
        db.monthlyDues,
        db.collections,
        db.paymentAllocations,
        db.advanceBalances,
        db.companyReconciliations,
        db.auditLogs,
      ],
      async () => {
        const currentClaim = await db.directPaymentClaims.get(claim.id)

        if (!currentClaim || !['PENDING', 'PARTIAL'].includes(currentClaim.status)) {
          throw new Error('This claim has already been processed.')
        }

        const claimedAmount = getClaimedAmount(currentClaim)
        const alreadyVerified = getVerifiedAmount(currentClaim)
        const amountToVerify = claimedAmount - alreadyVerified

        if (amountToVerify <= 0) {
          throw new Error('There is no remaining amount to verify.')
        }

        amountVerified = amountToVerify

        const customer = await db.customers.get(currentClaim.customerId)

        if (!customer) {
          throw new Error('Customer record not found.')
        }

        const dues = await db.monthlyDues
          .where('customerId')
          .equals(Number(currentClaim.customerId))
          .toArray()

        const payableDues = dues
          .map((due) => ({
            ...due,
            currentBalance: getDueBalance(due),
          }))
          .filter((due) => due.currentBalance > 0)
          .sort((a, b) =>
            String(a.monthKey).localeCompare(String(b.monthKey))
          )

        const reconciliationNo = generateNumber('COMP', verificationDate)

        const reconciliationId = await db.companyReconciliations.add({
          reconciliationNo,
          visitDate: verificationDate,
          claimId: currentClaim.id,
          customerId: currentClaim.customerId,
          verifiedAmount: amountToVerify,
          createdAt,
        })

        const receiptNo = generateNumber('DIRECT', verificationDate)

        const collectionId = await db.collections.add({
          receiptNo,
          customerId: customer.id,
          customerCode: getCustomerCode(customer),
          customerName: customer.name,
          paymentDate: verificationDate,
          paymentSource: 'DIRECT_COMPANY',
          amount: amountToVerify,
          status: 'CONFIRMED',
          reconciliationId,
          directPaymentClaimId: currentClaim.id,
          notes: currentClaim.notes || '',
          createdAt,
        })

        let remaining = amountToVerify

        // Allocate payment to oldest outstanding dues first.
        for (const due of payableDues) {
          if (remaining <= 0) break

          const allocation = Math.min(remaining, due.currentBalance)
          const newPaidAmount = Number(due.paidAmount || 0) + allocation
          const newBalance = due.currentBalance - allocation

          await db.paymentAllocations.add({
            collectionId,
            customerId: customer.id,
            dueId: due.id,
            monthKey: due.monthKey,
            amount: allocation,
            createdAt,
          })

          await db.monthlyDues.update(due.id, {
            paidAmount: newPaidAmount,
            balance: newBalance,
            status: newBalance <= 0 ? 'PAID' : 'PARTIAL',
            updatedAt: createdAt,
          })

          remaining -= allocation
        }

        // Excess verified payment becomes customer advance credit.
        if (remaining > 0) {
          await db.advanceBalances.add({
            customerId: customer.id,
            transactionDate: verificationDate,
            transactionType: 'ADVANCE_CREDIT',
            referenceId: collectionId,
            amount: remaining,
            description: `Verified direct company payment - ${receiptNo}`,
            createdAt,
          })
        }

        // Mark the entire remaining claim as verified.
        await db.directPaymentClaims.update(currentClaim.id, {
          verifiedAmount: claimedAmount,
          remainingAmount: 0,
          status: 'VERIFIED',
          lastVerifiedDate: verificationDate,
          updatedAt: createdAt,
        })

        await db.auditLogs.add({
          entityType: 'DIRECT_PAYMENT_CLAIM',
          entityId: currentClaim.id,
          action: 'DIRECT_PAYMENT_CLAIM_FULLY_VERIFIED',
          createdAt,
        })

        await db.auditLogs.add({
          entityType: 'COLLECTION',
          entityId: collectionId,
          action: 'DIRECT_COMPANY_PAYMENT_CONFIRMED',
          createdAt,
        })
      },
    )

    alert(
      `Payment verified successfully.\n\nVerified amount: ${currency(amountVerified)}\n\nCustomer balance updated. Cash in hand unchanged.`
    )

  } catch (error) {
    console.error('Company payment verification error:', error)
    alert(error.message || 'Unable to verify company payment.')
  } finally {
    setSavingClaimId(null)
  }
}



  const rejectClaim = async (claim) => {
    const remainingAmount = getRemainingClaim(claim)

    if (remainingAmount <= 0) {
      alert('There is no remaining amount to reject.')
      return
    }

    const reason = window.prompt(
      `Enter the reason for rejecting the remaining ${currency(remainingAmount)}:`,
    )

    if (reason === null) return

    if (!reason.trim()) {
      alert('A rejection reason is required.')
      return
    }

    try {
      const createdAt = new Date().toISOString()

      await db.transaction(
        'rw',
        [db.directPaymentClaims, db.auditLogs],
        async () => {
          const currentClaim = await db.directPaymentClaims.get(claim.id)

          if (
            !currentClaim ||
            !['PENDING', 'PARTIAL'].includes(currentClaim.status)
          ) {
            throw new Error('This claim is no longer available.')
          }

          const remaining = getRemainingClaim(currentClaim)

          if (remaining <= 0) {
            throw new Error('There is no remaining amount to reject.')
          }

          const hasVerifiedAmount = getVerifiedAmount(currentClaim) > 0

          await db.directPaymentClaims.update(claim.id, {
            remainingAmount: 0,
            rejectedAmount: remaining,
            rejectionReason: reason.trim(),
            rejectedDate: today(),
            status: hasVerifiedAmount
              ? 'PARTIAL_REJECTED'
              : 'REJECTED',
            updatedAt: createdAt,
          })

          await db.auditLogs.add({
            entityType: 'DIRECT_PAYMENT_CLAIM',
            entityId: claim.id,
            action: hasVerifiedAmount
              ? 'DIRECT_PAYMENT_REMAINDER_REJECTED'
              : 'DIRECT_PAYMENT_CLAIM_REJECTED',
            createdAt,
          })
        },
      )

      alert('The unverified claim amount has been rejected.')
    } catch (error) {
      console.error('Claim rejection error:', error)
      alert(error.message || 'Unable to reject claim.')
    }
  }

  return (
    <div className="company-payments-page">
      <header className="company-page-header">
        <div>
          <h1>Company Payments</h1>
          <p>
            Record customer direct payments and verify them against company
            records.
          </p>
        </div>

        <div className="company-header-icon">
          <Building2 size={26} />
        </div>
      </header>

      <div className="company-summary">
        <div className="company-summary-card">
          <span>Pending Claims</span>
          <strong>{pendingClaims.length}</strong>
          <small>Awaiting verification</small>
        </div>

        <div className="company-summary-card">
          <span>Pending Amount</span>
          <strong>{currency(pendingTotal)}</strong>
          <small>Not yet deducted from customer dues</small>
        </div>
      </div>

      <nav className="company-tabs">
        <button
          type="button"
          className={activeTab === 'enter' ? 'active' : ''}
          onClick={() => setActiveTab('enter')}
        >
          <ClipboardList size={17} />
          Enter Company Payment
        </button>

        <button
          type="button"
          className={activeTab === 'verify' ? 'active' : ''}
          onClick={() => setActiveTab('verify')}
        >
          <CheckCircle size={17} />
          Confirm / Verify
          {pendingClaims.length > 0 && (
            <span className="company-tab-count">
              {pendingClaims.length}
            </span>
          )}
        </button>

        <button
          type="button"
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          <Receipt size={17} />
          Payment History
        </button>
      </nav>

      {activeTab === 'enter' && (
        <section className="company-card">
          <div className="company-section-heading">
            <div>
              <h2>Enter Customer Company Payment</h2>
              <p>
                Record a payment the customer says was paid directly to the
                company.
              </p>
            </div>

            <span className="company-status pending">
              <Clock size={14} />
              Pending Verification
            </span>
          </div>

          <div className="company-warning">
            <AlertCircle size={18} />
            <div>
              <strong>This is only a payment claim.</strong>
              <p>
                Saving this entry will not reduce customer outstanding dues
                and will not increase your cash in hand. The amount is applied
                only after company verification.
              </p>
            </div>
          </div>

          <form onSubmit={saveClaim}>
            <div className="company-form-grid">
              <div className="company-field company-field-full">
                <label>Search Customer *</label>

                <div className="company-search-box">
                  <Search size={17} />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value)
                      setCustomerId('')
                    }}
                    placeholder="Search customer by name, code or phone..."
                  />
                </div>

                {search.trim() && !selectedCustomer && (
                  <div className="company-customer-results">
                    {filteredCustomers.slice(0, 8).map((customer) => (
                      <button
                        type="button"
                        key={customer.id}
                        onClick={() => {
                          setCustomerId(String(customer.id))
                          setSearch(
                            `${customer.name} (${getCustomerCode(customer)})`,
                          )
                        }}
                      >
                        <User size={16} />
                        <span>
                          <strong>{customer.name}</strong>
                          <small>
                            {getCustomerCode(customer)} · {customer.phone}
                          </small>
                        </span>
                      </button>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <p>No active customers found.</p>
                    )}
                  </div>
                )}

                {selectedCustomer && (
                  <div className="company-selected-customer">
                    <CheckCircle size={17} />
                    <span>
                      {selectedCustomer.name} —{' '}
                      {getCustomerCode(selectedCustomer)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerId('')
                        setSearch('')
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>

              <div className="company-field">
                <label>Payment Date *</label>
                <div className="company-input-icon">
                  <CalendarDays size={17} />
                  <input
                    type="date"
                    value={claimedDate}
                    onChange={(event) => setClaimedDate(event.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="company-field">
                <label>Amount Customer Paid (LKR) *</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={claimedAmount}
                  onChange={(event) => setClaimedAmount(event.target.value)}
                  placeholder="Enter claimed amount"
                  required
                />
              </div>

              <div className="company-field company-field-full">
                <label>Company Receipt / Reference Number</label>
                <input
                  value={companyReference}
                  onChange={(event) =>
                    setCompanyReference(event.target.value)
                  }
                  placeholder="Optional company receipt or bank reference"
                />
              </div>

              <div className="company-field company-field-full">
                <label>Notes</label>
                <textarea
                  rows="3"
                  value={claimNotes}
                  onChange={(event) => setClaimNotes(event.target.value)}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className="company-form-footer">
              <span>
                <Clock size={15} />
                This entry will remain pending until verified.
              </span>

              <button
                type="submit"
                className="company-primary-btn"
                disabled={
                  savingClaim ||
                  !customerId ||
                  !claimedAmount ||
                  Number(claimedAmount) <= 0
                }
              >
                <ClipboardList size={17} />
                {savingClaim ? 'Saving...' : 'Save Payment Claim'}
              </button>
            </div>
          </form>
        </section>
      )}

      {activeTab === 'verify' && (
        <section className="company-card">
          <div className="company-section-heading">
            <div>
              <h2>Verify Company Payments</h2>
              <p>
                Verify the amount confirmed by the company. You can verify a
                claim fully or partially.
              </p>
            </div>

            <button
              type="button"
              className="company-refresh-btn"
              onClick={() => {
                setVerificationAmounts({})
                setVerificationDate(today())
              }}
            >
              <RefreshCw size={16} />
              Clear inputs
            </button>
          </div>

          <div className="company-warning">
            <AlertCircle size={18} />
            <div>
              <strong>Verify only the confirmed amount.</strong>
              <p>
                The verified amount reduces customer dues. Any excess becomes
                advance credit. No physical cash transaction is created.
              </p>
            </div>
          </div>

          {pendingClaims.length === 0 ? (
            <div className="company-empty">
              <CheckCircle size={32} />
              <strong>No pending company payment claims</strong>
              <p>New customer claims will appear here.</p>
            </div>
          ) : (
            <div className="company-claims-list">
              {pendingClaims.map((claim) => {
                const customer = customerMap.get(claim.customerId)
                const remaining = getRemainingClaim(claim)
                const amountValue =
                  verificationAmounts[claim.id] ?? String(remaining)

                return (
                  <article className="company-claim-card" key={claim.id}>
                    <div className="company-claim-top">
                      <div className="company-claim-customer">
                        <div className="company-claim-avatar">
                          {(customer?.name || claim.customerName || '?')
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {customer?.name || claim.customerName || 'Unknown customer'}
                          </strong>
                          <small>
                            {customer
                              ? getCustomerCode(customer)
                              : claim.customerCode || '-'}
                          </small>
                        </div>
                      </div>

                      <span className="company-status pending">
                        <Clock size={13} />
                        {claimStatusLabel(claim.status)}
                      </span>
                    </div>

                    <div className="company-claim-details">
                      <div>
                        <span>Claimed date</span>
                        <strong>{formatDate(claim.claimedDate)}</strong>
                      </div>

                      <div>
                        <span>Claimed amount</span>
                        <strong>{currency(getClaimedAmount(claim))}</strong>
                      </div>

                      <div>
                        <span>Already verified</span>
                        <strong className="verified-text">
                          {currency(getVerifiedAmount(claim))}
                        </strong>
                      </div>

                      <div>
                        <span>Remaining to verify</span>
                        <strong className="pending-text">
                          {currency(remaining)}
                        </strong>
                      </div>
                    </div>

                    {claim.companyReference && (
                      <p className="company-reference">
                        Company reference: {claim.companyReference}
                      </p>
                    )}

                    {claim.notes && (
                      <p className="company-claim-notes">
                        Customer notes: {claim.notes}
                      </p>
                    )}

<div className="company-claim-actions">
  <button
    type="button"
    className="company-reject-btn"
    disabled={savingClaimId === claim.id}
    onClick={() => rejectClaim(claim)}
  >
    <XCircle size={16} />
    Reject Remaining
  </button>

  <button
    type="button"
    className="company-verify-btn"
    disabled={savingClaimId === claim.id}
    onClick={() => verifyClaim(claim)}
  >
    <CheckCircle size={16} />
    {savingClaimId === claim.id ? 'Verifying...' : 'Verify Payment'}
  </button>
</div>

                  </article>
                )
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'history' && (
        <section className="company-card">
          <div className="company-section-heading">
            <div>
              <h2>Company Payment History</h2>
              <p>
                Review pending, verified, partially verified and rejected
                claims.
              </p>
            </div>
          </div>

          <div className="company-history-filters">
            <div className="company-search-box">
              <Search size={17} />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search customer or company reference..."
              />
            </div>

            <select
              value={historyFilter}
              onChange={(event) => setHistoryFilter(event.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="PARTIAL">Partially verified</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="PARTIAL_REJECTED">
                Partially verified / remainder rejected
              </option>
            </select>
          </div>

          <div className="company-table-wrapper">
            <table className="company-history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Company Reference</th>
                  <th>Claimed</th>
                  <th>Verified</th>
                  <th>Remaining</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {historyClaims.map((claim) => {
                  const customer = customerMap.get(claim.customerId)

                  return (
                    <tr key={claim.id}>
                      <td>{formatDate(claim.claimedDate)}</td>
                      <td>
                        <strong>
                          {customer?.name || claim.customerName || 'Unknown'}
                        </strong>
                        <small>
                          {customer
                            ? getCustomerCode(customer)
                            : claim.customerCode || ''}
                        </small>
                      </td>
                      <td>{claim.companyReference || '-'}</td>
                      <td>{currency(getClaimedAmount(claim))}</td>
                      <td className="verified-text">
                        {currency(getVerifiedAmount(claim))}
                      </td>
                      <td>
                        {currency(getRemainingClaim(claim))}
                      </td>
                      <td>
                        <span
                          className={`company-status ${claim.status?.toLowerCase()}`}
                        >
                          {claimStatusLabel(claim.status)}
                        </span>

                        {claim.rejectionReason && (
                          <small className="rejection-reason">
                            {claim.rejectionReason}
                          </small>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {historyClaims.length === 0 && (
                  <tr>
                    <td colSpan="7" className="company-table-empty">
                      No company payment records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

