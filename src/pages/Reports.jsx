import { useEffect, useMemo, useState } from 'react'
import { db } from '../database/db'
import '../styles/reports.css'

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const firstDayOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

const currency = (value) =>
  `LKR ${Number(value || 0).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

const formatDate = (value) => {
  if (!value) return '-'
  const date = String(value).slice(0, 10)
  const parts = date.split('-')

  if (parts.length !== 3) return date

  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const getSourceName = (source) => {
  if (source === 'CASH') return 'Cash Collection'
  if (source === 'DIRECT_COMPANY') return 'Direct Company Payment'
  return source || 'Collection'
}

export default function Reports() {
  const [fromDate, setFromDate] = useState(firstDayOfMonth())
  const [toDate, setToDate] = useState(today())

  const [collections, setCollections] = useState([])
  const [handovers, setHandovers] = useState([])

  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const loadReport = async () => {
    if (!fromDate || !toDate) {
      alert('Please select both dates.')
      return
    }

    if (fromDate > toDate) {
      alert('From Date cannot be later than To Date.')
      return
    }

    setLoading(true)

    try {
      const [allCollections, allHandovers] = await Promise.all([
        db.collections.toArray(),
        db.cashHandovers.toArray(),
      ])

      const filteredCollections = allCollections.filter((item) => {
        const date = String(item.paymentDate || '').slice(0, 10)

        return (
          date >= fromDate &&
          date <= toDate &&
          item.status === 'CONFIRMED'
        )
      })

      const filteredHandovers = allHandovers.filter((item) => {
        const date = String(item.handoverDate || '').slice(0, 10)

        return (
          date >= fromDate &&
          date <= toDate &&
          item.status === 'CONFIRMED'
        )
      })

      setCollections(filteredCollections)
      setHandovers(filteredHandovers)
      setLoaded(true)
    } catch (error) {
      console.error('Report loading error:', error)
      alert(error.message || 'Unable to load report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReport()
    // Load the initial current-month report.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const cashCollections = collections
      .filter((item) => item.paymentSource === 'CASH')
      .reduce((total, item) => total + Number(item.amount || 0), 0)

    const directPayments = collections
      .filter((item) => item.paymentSource === 'DIRECT_COMPANY')
      .reduce((total, item) => total + Number(item.amount || 0), 0)

    const totalCollections = collections.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    )

    const totalHandovers = handovers.reduce(
      (total, item) => total + Number(item.amount || 0),
      0
    )

    return {
      cashCollections,
      directPayments,
      totalCollections,
      totalHandovers,
      netCashMovement: cashCollections - totalHandovers,
    }
  }, [collections, handovers])

  const allTransactions = useMemo(() => {
    const collectionRows = collections.map((item) => ({
      id: `collection-${item.id}`,
      date: item.paymentDate,
      type: getSourceName(item.paymentSource),
      reference: item.receiptNo || '-',
      person: item.customerName || '-',
      amount: Number(item.amount || 0),
      direction: 'IN',
      remark: item.notes || '-',
    }))

    const handoverRows = handovers.map((item) => ({
      id: `handover-${item.id}`,
      date: item.handoverDate,
      type: 'Cash Handover',
      reference: item.handoverNo || '-',
      person: item.recipientName || item.recipientId || '-',
      amount: Number(item.amount || 0),
      direction: 'OUT',
      remark: item.comment || '-',
    }))

    return [...collectionRows, ...handoverRows].sort((a, b) =>
      String(b.date).localeCompare(String(a.date))
    )
  }, [collections, handovers])

  const displayedTransactions = useMemo(() => {
    if (activeTab === 'COLLECTIONS') {
      return allTransactions.filter((item) => item.direction === 'IN')
    }

    if (activeTab === 'HANDOVERS') {
      return allTransactions.filter((item) => item.direction === 'OUT')
    }

    return allTransactions
  }, [allTransactions, activeTab])

  return (
    <div className="reports-page">
      <div className="reports-header">
        <div>
          <h2>Reports</h2>
          <p>View collections and cash handovers for a selected period.</p>
        </div>
      </div>

      {/* Date range */}
      <section className="report-filter-card">
        <div className="report-date-field">
          <label>From Date</label>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>

        <div className="report-date-field">
          <label>To Date</label>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            max={today()}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="report-search-button"
          onClick={loadReport}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'View Report'}
        </button>
      </section>

      {loaded && (
        <>
          {/* Summary */}
          <div className="report-summary-grid">
            <div className="report-summary-card">
              <span>Total Collections</span>
              <strong>{currency(summary.totalCollections)}</strong>
              <small>{collections.length} transactions</small>
            </div>

            <div className="report-summary-card cash">
              <span>Cash Collections</span>
              <strong>{currency(summary.cashCollections)}</strong>
              <small>Physical cash received</small>
            </div>

            <div className="report-summary-card direct">
              <span>Direct Company Payments</span>
              <strong>{currency(summary.directPayments)}</strong>
              <small>Verified payments</small>
            </div>

            <div className="report-summary-card handover">
              <span>Total Handovers</span>
              <strong>{currency(summary.totalHandovers)}</strong>
              <small>{handovers.length} handovers</small>
            </div>

            <div className="report-summary-card net">
              <span>Net Cash Movement</span>
              <strong>{currency(summary.netCashMovement)}</strong>
              <small>Cash collections minus handovers</small>
            </div>
          </div>

          {/* Transaction history */}
          <section className="report-transactions-card">
            <div className="report-transactions-header">
              <div>
                <h3>Transaction Details</h3>
                <p>
                  {formatDate(fromDate)} – {formatDate(toDate)}
                </p>
              </div>
            </div>

            <div className="report-tabs">
              <button
                className={activeTab === 'ALL' ? 'active' : ''}
                onClick={() => setActiveTab('ALL')}
                type="button"
              >
                All ({allTransactions.length})
              </button>

              <button
                className={activeTab === 'COLLECTIONS' ? 'active' : ''}
                onClick={() => setActiveTab('COLLECTIONS')}
                type="button"
              >
                Collections ({collections.length})
              </button>

              <button
                className={activeTab === 'HANDOVERS' ? 'active' : ''}
                onClick={() => setActiveTab('HANDOVERS')}
                type="button"
              >
                Handovers ({handovers.length})
              </button>
            </div>

            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Customer / Received By</th>
                    <th>Remark</th>
                    <th className="amount-column">Amount</th>
                  </tr>
                </thead>

                <tbody>
                  {displayedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="report-empty">
                        No transactions found for this date range.
                      </td>
                    </tr>
                  ) : (
                    displayedTransactions.map((item) => (
                      <tr key={item.id}>
                        <td>{formatDate(item.date)}</td>
                        <td>
                          <span
                            className={`report-type ${
                              item.direction === 'OUT'
                                ? 'type-handover'
                                : item.type === 'Direct Company Payment'
                                  ? 'type-direct'
                                  : 'type-cash'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td>{item.reference}</td>
                        <td>{item.person}</td>
                        <td>{item.remark}</td>
                        <td
                          className={`amount-column ${
                            item.direction === 'OUT'
                              ? 'amount-out'
                              : 'amount-in'
                          }`}
                        >
                          {item.direction === 'OUT' ? '− ' : '+ '}
                          {currency(item.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="report-table-footer">
              <span>
                Showing {displayedTransactions.length} transaction(s)
              </span>
              <span>
                Cash movement: <strong>{currency(summary.netCashMovement)}</strong>
              </span>
            </div>
          </section>
        </>
      )}
    </div>
  )
}