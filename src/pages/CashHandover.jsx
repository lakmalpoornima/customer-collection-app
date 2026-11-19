import { useCallback, useEffect, useState } from 'react'
import { db } from '../database/db'
import '../styles/cash-handover.css'

const STAFF_MEMBERS = ['Harsha', 'Kavindya', 'Dilini', 'Other']

const today = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

const currency = (amount) =>
  `LKR ${Number(amount || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const getPhysicalCash = async () => {
  const [collections, handovers] = await Promise.all([
    db.collections.toArray(),
    db.cashHandovers.toArray(),
  ])

  const cashReceived = collections
    .filter(
      (item) =>
        item.paymentSource === 'CASH' &&
        item.status === 'CONFIRMED'
    )
    .reduce((total, item) => total + Number(item.amount || 0), 0)

  const cashHandedOver = handovers
    .filter((item) => item.status === 'CONFIRMED')
    .reduce((total, item) => total + Number(item.amount || 0), 0)

  return Math.max(0, cashReceived - cashHandedOver)
}

export default function CashHandover() {
  const [cashInHand, setCashInHand] = useState(0)
  const [amount, setAmount] = useState('')
  const [handoverDate, setHandoverDate] = useState(today())
  const [recipient, setRecipient] = useState('')
  const [comment, setComment] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)

      const [balance, records] = await Promise.all([
        getPhysicalCash(),
        db.cashHandovers.toArray(),
      ])

      setCashInHand(balance)
      setAmount(String(balance))
      setHistory(
        records.sort((a, b) =>
          String(b.handoverDate).localeCompare(String(a.handoverDate))
        )
      )
    } catch (error) {
      console.error('Cash handover loading error:', error)
      alert('Unable to load cash handover details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

const handleSave = async (event) => {
  event.preventDefault()

  const handoverAmount = Number(amount)

  if (!recipient) {
    alert('Please select the staff member.')
    return
  }

  if (!handoverDate) {
    alert('Please select the handover date.')
    return
  }

  if (!Number.isFinite(handoverAmount) || handoverAmount <= 0) {
    alert('Please enter a valid handover amount.')
    return
  }

  if (recipient === 'Other' && !comment.trim()) {
    alert('Please enter a comment when selecting Other.')
    return
  }

  setSaving(true)

  try {
    const createdAt = new Date().toISOString()
    const handoverNo = `HO-${Date.now()}`

    await db.transaction(
      'rw',
      [
        db.customers,
        db.collections,
        db.cashHandovers,
        db.auditLogs,
      ],
      async () => {
        // Read cash collections inside this transaction.
        const collections = await db.collections.toArray()

        const handovers = await db.cashHandovers.toArray()

        const cashReceived = collections
          .filter(
            (item) =>
              item.paymentSource === 'CASH' &&
              item.status === 'CONFIRMED'
          )
          .reduce(
            (total, item) => total + Number(item.amount || 0),
            0
          )

        const cashHandedOver = handovers
          .filter((item) => item.status === 'CONFIRMED')
          .reduce(
            (total, item) => total + Number(item.amount || 0),
            0
          )

        const currentCash = cashReceived - cashHandedOver

        if (handoverAmount > currentCash) {
          throw new Error(
            `Insufficient cash in hand. Available: ${currency(currentCash)}`
          )
        }

        // Save handover.
        const handoverId = await db.cashHandovers.add({
          handoverNo,
          recipientId: recipient,
          recipientName: recipient,
          handoverDate,
          amount: handoverAmount,
          comment: comment.trim(),
          status: 'CONFIRMED',
          createdAt,
        })

        // Save audit log.
        await db.auditLogs.add({
          entityType: 'CASH_HANDOVER',
          entityId: handoverId,
          action: 'CASH_HANDED_OVER',
          createdAt,
        })
      }
    )

    alert(
      `Cash handover saved successfully.\n\nRecipient: ${recipient}\nAmount: ${currency(handoverAmount)}`
    )

    setRecipient('')
    setComment('')
    setHandoverDate(today())

    await loadData()

  } catch (error) {
    console.error('Cash handover error:', error)
    console.error('Inner error:', error.inner)

    alert(error.inner?.message || error.message || 'Unable to save handover.')

  } finally {
    setSaving(false)
  }
}

  return (
    <div className="cash-handover-page">
      <div className="handover-page-header">
        <div>
          <h2>Cash Handover</h2>
          <p>Record cash handed over to staff members.</p>
        </div>
      </div>

      <div className="handover-balance-card">
        <div>
          <span>Current Cash in Hand</span>
          <h2>{currency(cashInHand)}</h2>
        </div>
        <div className="handover-balance-icon">₹</div>
      </div>

      <div className="handover-content">
        <section className="handover-form-card">
          <h3>New Cash Handover</h3>

          <form onSubmit={handleSave}>
            <div className="handover-form-group">
              <label>Handover Amount (LKR)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={cashInHand}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
              />
              <small>
                Available cash: {currency(cashInHand)}
              </small>
            </div>

            <div className="handover-form-group">
              <label>Handover Date</label>
              <input
                type="date"
                value={handoverDate}
                onChange={(e) => setHandoverDate(e.target.value)}
                required
              />
            </div>

            <div className="handover-form-group">
              <label>Received By</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                required
              >
                <option value="">Select staff member</option>
                {STAFF_MEMBERS.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
            </div>

            <div className="handover-form-group">
              <label>
                Comment / Remark
                {recipient === 'Other' && (
                  <span className="required-label"> Required</span>
                )}
              </label>

              <textarea
                rows="3"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  recipient === 'Other'
                    ? 'Please specify who received the money...'
                    : 'Optional comment or remark'
                }
                required={recipient === 'Other'}
              />
            </div>

            <button
              type="submit"
              className="handover-save-button"
              disabled={saving || loading || cashInHand <= 0}
            >
              {saving ? 'Saving...' : 'Save Handover'}
            </button>
          </form>
        </section>

        <section className="handover-history-card">
          <div className="handover-history-header">
            <div>
              <h3>Handover History</h3>
              <p>Previously recorded cash handovers.</p>
            </div>
            <button
              type="button"
              className="handover-refresh-button"
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="handover-empty">Loading...</div>
          ) : history.length === 0 ? (
            <div className="handover-empty">
              No cash handovers recorded yet.
            </div>
          ) : (
            <div className="handover-table-wrapper">
              <table className="handover-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Received By</th>
                    <th>Amount</th>
                    <th>Comment / Remark</th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((item) => (
                    <tr key={item.id}>
                      <td>{item.handoverDate}</td>
                      <td>
                        <span className="handover-recipient">
                          {item.recipientName || item.recipientId || '-'}
                        </span>
                      </td>
                      <td className="handover-amount">
                        {currency(item.amount)}
                      </td>
                      <td>{item.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}