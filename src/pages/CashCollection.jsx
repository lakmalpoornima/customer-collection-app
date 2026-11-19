import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Search,
  Wallet,
  User,
  Receipt,
  CalendarDays,
  TrendingUp,
  Coins,
} from 'lucide-react'

import { db } from '../database/db'
import '../styles/cash-collection.css'

const today = new Date().toISOString().slice(0, 10)

const currency = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const getCustomerCode = (customer) =>
  customer.customerCode || `CUS${String(customer.id).padStart(5, '0')}`

function calculateDueBalance(due) {
  if (due.balance !== undefined && due.balance !== null) {
    return Math.max(0, Number(due.balance))
  }

  return Math.max(
    0,
    Number(due.dueAmount || 0) - Number(due.paidAmount || 0),
  )
}

export default function CashCollection() {
  const [search, setSearch] = useState('')
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(today)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const customers =
    useLiveQuery(
      () => db.customers.where('status').equals('active').toArray(),
      [],
    ) || []

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === selectedCustomerId,
  )

  const dues =
    useLiveQuery(
      () =>
        selectedCustomerId
          ? db.monthlyDues
              .where('customerId')
              .equals(Number(selectedCustomerId))
              .toArray()
          : [],
      [selectedCustomerId],
    ) || []

  const advanceTransactions =
    useLiveQuery(
      () =>
        selectedCustomerId
          ? db.advanceBalances
              .where('customerId')
              .equals(Number(selectedCustomerId))
              .toArray()
          : [],
      [selectedCustomerId],
    ) || []

  const outstandingDues = useMemo(() => {
    return dues
      .map((due) => ({
        ...due,
        currentBalance: calculateDueBalance(due),
      }))
      .filter((due) => due.currentBalance > 0)
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
  }, [dues])

  const totalOutstanding = outstandingDues.reduce(
    (total, due) => total + due.currentBalance,
    0,
  )

  // Advance balance = advance credits - advance amounts used.
  const advanceBalance = advanceTransactions.reduce(
    (total, transaction) => {
      if (transaction.transactionType === 'ADVANCE_CREDIT') {
        return total + Number(transaction.amount || 0)
      }

      if (transaction.transactionType === 'ADVANCE_USED') {
        return total - Number(transaction.amount || 0)
      }

      return total
    },
    0,
  )

  const filteredCustomers = customers.filter((customer) => {
    const value = search.toLowerCase()

    return (
      customer.name.toLowerCase().includes(value) ||
      String(customer.phone || '').includes(value) ||
      String(customer.customerCode || '').toLowerCase().includes(value)
    )
  })

  const paymentAmount = Number(amount || 0)

  const allocatedToDues = Math.min(paymentAmount, totalOutstanding)

  const newAdvance = Math.max(0, paymentAmount - totalOutstanding)

  const previewAllocations = useMemo(() => {
    let remaining = paymentAmount

    return outstandingDues.map((due) => {
      const allocated = Math.min(remaining, due.currentBalance)
      remaining -= allocated

      return {
        ...due,
        allocated,
        remaining: due.currentBalance - allocated,
      }
    })
  }, [outstandingDues, paymentAmount])

  const generateReceiptNo = () => {
    const datePart = paymentDate.replaceAll('-', '')
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase()

    return `CASH-${datePart}-${randomPart}`
  }

  const saveCollection = async (e) => {
    e.preventDefault()

    if (!selectedCustomer) {
      alert('Please select a customer.')
      return
    }

    if (!paymentDate) {
      alert('Please select payment date.')
      return
    }

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      alert('Please enter a valid payment amount.')
      return
    }

    setSaving(true)

    try {
      const receiptNo = generateReceiptNo()
      const createdAt = new Date().toISOString()

      await db.transaction(
        'rw',
        [
          db.monthlyDues,
          db.collections,
          db.paymentAllocations,
          db.cashbook,
          db.advanceBalances,
          db.auditLogs,
        ],
        async () => {
          const currentDues = await db.monthlyDues
            .where('customerId')
            .equals(Number(selectedCustomerId))
            .toArray()

          const payableDues = currentDues
            .map((due) => ({
              ...due,
              currentBalance: calculateDueBalance(due),
            }))
            .filter((due) => due.currentBalance > 0)
            .sort((a, b) => a.monthKey.localeCompare(b.monthKey))

          const currentOutstanding = payableDues.reduce(
            (total, due) => total + due.currentBalance,
            0,
          )

          const collectionId = await db.collections.add({
            receiptNo,
            customerId: selectedCustomer.id,
            customerCode: getCustomerCode(selectedCustomer),
            customerName: selectedCustomer.name,
            paymentDate,
            paymentSource: 'CASH',
            amount: paymentAmount,
            allocatedAmount: Math.min(paymentAmount, currentOutstanding),
            advanceAmount: Math.max(0, paymentAmount - currentOutstanding),
            status: 'CONFIRMED',
            notes: notes.trim(),
            createdAt,
          })

          let remainingAmount = paymentAmount

          for (const due of payableDues) {
            if (remainingAmount <= 0) break

            const allocatedAmount = Math.min(
              remainingAmount,
              due.currentBalance,
            )

            const newPaidAmount =
              Number(due.paidAmount || 0) + allocatedAmount

            const newBalance =
              due.currentBalance - allocatedAmount

            await db.paymentAllocations.add({
              collectionId,
              customerId: selectedCustomer.id,
              dueId: due.id,
              monthKey: due.monthKey,
              amount: allocatedAmount,
              createdAt,
            })

            await db.monthlyDues.update(due.id, {
              paidAmount: newPaidAmount,
              balance: newBalance,
              status: newBalance <= 0 ? 'PAID' : 'PARTIAL',
              updatedAt: createdAt,
            })

            remainingAmount -= allocatedAmount
          }

          // Any remaining amount is recorded as advance credit.
          if (remainingAmount > 0) {
            await db.advanceBalances.add({
              customerId: selectedCustomer.id,
              transactionDate: paymentDate,
              transactionType: 'ADVANCE_CREDIT',
              referenceId: collectionId,
              amount: remainingAmount,
              description: `Advance received - ${receiptNo}`,
              createdAt,
            })
          }

          // Full cash received increases physical cash.
          await db.cashbook.add({
            transactionNo: receiptNo,
            transactionType: 'CASH_COLLECTION',
            transactionDate: paymentDate,
            referenceId: collectionId,
            amount: paymentAmount,
            description: `Cash collected from ${selectedCustomer.name}`,
            createdAt,
          })

          await db.auditLogs.add({
            entityType: 'COLLECTION',
            entityId: collectionId,
            action: 'CASH_COLLECTION_CREATED',
            createdAt,
          })
        },
      )

      alert(
        `Collection saved successfully.\nReceipt: ${receiptNo}\nAdvance: ${currency(newAdvance)}`,
      )

      setAmount('')
      setNotes('')
      setSearch('')
    } catch (error) {
      console.error('Cash collection error:', error)
      alert(error.message || 'Unable to save cash collection.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cash-page">
      <div className="cash-page-header">
        <div>
          <h1>Cash Collection</h1>
          <p>Record payments received directly from customers.</p>
        </div>

        <div className="cash-page-icon">
          <Wallet size={25} />
        </div>
      </div>

      <div className="cash-layout">
        <div className="cash-main">
          <section className="cash-card">
            <h2>
              <User size={19} />
              Select Customer
            </h2>

            <div className="cash-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, code or phone..."
              />
            </div>

            <div className="customer-selection-list">
              {filteredCustomers.map((customer) => (
                <button
                  type="button"
                  key={customer.id}
                  className={`customer-option ${
                    selectedCustomerId === String(customer.id) ? 'active' : ''
                  }`}
                  onClick={() => setSelectedCustomerId(String(customer.id))}
                >
                  <span className="customer-avatar">
                    {customer.name.charAt(0).toUpperCase()}
                  </span>

                  <span className="customer-option-details">
                    <strong>{customer.name}</strong>
                    <small>
                      {getCustomerCode(customer)} · {customer.phone}
                    </small>
                  </span>

                  {selectedCustomerId === String(customer.id) && (
                    <span className="selected-mark">Selected</span>
                  )}
                </button>
              ))}

              {filteredCustomers.length === 0 && (
                <p className="cash-empty">No customers found.</p>
              )}
            </div>
          </section>

          {selectedCustomer && (
            <>
              <section className="cash-card">
                <h2>
                  <TrendingUp size={19} />
                  Customer Balance
                </h2>

                <div className="balance-summary">
                  <div className="balance-item outstanding">
                    <span>Outstanding Dues</span>
                    <strong>{currency(totalOutstanding)}</strong>
                  </div>

                  <div className="balance-item advance">
                    <span>Available Advance</span>
                    <strong>{currency(advanceBalance)}</strong>
                  </div>
                </div>
              </section>

              <section className="cash-card">
                <h2>
                  <Receipt size={19} />
                  Collection Details
                </h2>

                <form onSubmit={saveCollection}>
                  <div className="cash-form-grid">
                    <div className="cash-field">
                      <label>Payment Date *</label>

                      <div className="cash-input-icon">
                        <CalendarDays size={17} />

                        <input
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="cash-field">
                      <label>Amount Received (LKR) *</label>

                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount"
                        required
                      />
                    </div>

                    <div className="cash-field full">
                      <label>Notes</label>

                      <textarea
                        rows="3"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional collection notes..."
                      />
                    </div>
                  </div>

                  <div className="collection-breakdown">
                    <div>
                      <span>Cash received</span>
                      <strong>{currency(paymentAmount)}</strong>
                    </div>

                    <div>
                      <span>Allocated to dues</span>
                      <strong>{currency(allocatedToDues)}</strong>
                    </div>

                    <div className="advance-result">
                      <span>New advance credit</span>
                      <strong>{currency(newAdvance)}</strong>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="save-collection-btn"
                    disabled={saving || !amount || paymentAmount <= 0}
                  >
                    <Wallet size={18} />
                    {saving ? 'Saving...' : 'Confirm Cash Collection'}
                  </button>
                </form>
              </section>
            </>
          )}
        </div>

        <aside className="cash-side">
          <section className="cash-card">
            <h2>Outstanding Dues</h2>

            {!selectedCustomer ? (
              <p className="cash-empty">
                Select a customer to view outstanding dues.
              </p>
            ) : outstandingDues.length === 0 ? (
              <p className="cash-empty">No outstanding dues.</p>
            ) : (
              <div className="dues-list">
                {outstandingDues.map((due) => (
                  <div className="due-row" key={due.id}>
                    <span>{due.monthKey}</span>
                    <strong>{currency(due.currentBalance)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          {selectedCustomer && paymentAmount > 0 && (
            <section className="cash-card">
              <h2>
                <Coins size={19} />
                Payment Allocation Preview
              </h2>

              <p className="allocation-note">
                Payment is allocated to the oldest outstanding month first.
                Any excess becomes advance credit.
              </p>

              {previewAllocations
                .filter((item) => item.allocated > 0)
                .map((item) => (
                  <div className="allocation-row" key={item.id}>
                    <div>
                      <strong>{item.monthKey}</strong>
                      <small>
                        Remaining: {currency(item.remaining)}
                      </small>
                    </div>

                    <span>{currency(item.allocated)}</span>
                  </div>
                ))}

              {newAdvance > 0 && (
                <div className="allocation-row advance-result">
                  <div>
                    <strong>Advance Credit</strong>
                    <small>Available for future monthly dues</small>
                  </div>

                  <span>{currency(newAdvance)}</span>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}