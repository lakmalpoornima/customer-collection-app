
import { useCallback, useEffect, useState } from 'react'
import {
  Banknote,
  HandCoins,
  Users,
  Wallet,
  CalendarDays,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react'
import { db } from '../database/db'
import '../styles/dashboard.css'

const money = (value) =>
  new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const dateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDateKey = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const formatDate = (value) => {
  if (!value) return '-'
  const date = new Date(`${getDateKey(value)}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-LK', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
}

const sumAmount = (items) =>
  items.reduce((total, item) => total + Number(item.amount || 0), 0)

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState({
    dailyCash: 0,
    dailyDirect: 0,
    dailyHandovers: 0,
    dailyVisits: 0,
    monthlyCash: 0,
    monthlyDirect: 0,
    monthlyHandovers: 0,
    cashInHand: 0,
    recentActivity: [],
  })

  const loadDashboard = useCallback(async () => {
    setLoading(true)

    try {
      const today = dateKey()
      const month = today.slice(0, 7)

      const [
        collections,
        handovers,
        visits,
        customers,
      ] = await Promise.all([
        db.collections.toArray(),
        db.cashHandovers.toArray(),
        db.visits.toArray(),
        db.customers.toArray(),
      ])

      const customerMap = new Map(
        customers.map((customer) => [
          Number(customer.id),
          customer.name || 'Unknown customer',
        ])
      )

      const confirmedCollections = collections.filter(
        (item) => item.status === 'CONFIRMED'
      )

      const confirmedHandovers = handovers.filter(
        (item) => item.status === 'CONFIRMED'
      )

      const cashCollections = confirmedCollections.filter(
        (item) => item.paymentSource === 'CASH'
      )

      const directCollections = confirmedCollections.filter(
        (item) => item.paymentSource === 'DIRECT_COMPANY'
      )

      const todayCash = cashCollections.filter(
        (item) => getDateKey(item.paymentDate) === today
      )

      const todayDirect = directCollections.filter(
        (item) => getDateKey(item.paymentDate) === today
      )

      const todayHandovers = confirmedHandovers.filter(
        (item) => getDateKey(item.handoverDate) === today
      )

      const todayVisits = visits.filter(
        (item) => getDateKey(item.visitDate) === today
      )

      // Count each customer only once per day.
      const uniqueDailyVisitors = new Set(
        todayVisits.map((item) => Number(item.customerId))
      )

      const monthCash = cashCollections.filter(
        (item) => getDateKey(item.paymentDate).startsWith(month)
      )

      const monthDirect = directCollections.filter(
        (item) => getDateKey(item.paymentDate).startsWith(month)
      )

      const monthHandovers = confirmedHandovers.filter(
        (item) => getDateKey(item.handoverDate).startsWith(month)
      )

      // Physical cash includes cash collections only.
      const totalCashReceived = sumAmount(cashCollections)
      const totalHandedOver = sumAmount(confirmedHandovers)

      const recentCollections = confirmedCollections.map((item) => ({
        id: `collection-${item.id}`,
        date: item.paymentDate,
        type: item.paymentSource === 'CASH'
          ? 'Cash Collection'
          : 'Company Payment',
        name: customerMap.get(Number(item.customerId)) || 'Unknown customer',
        amount: Number(item.amount || 0),
        direction: 'in',
      }))

      const recentHandovers = confirmedHandovers.map((item) => ({
        id: `handover-${item.id}`,
        date: item.handoverDate,
        type: 'Cash Handover',
        name: item.recipientName || item.recipientId || 'Recipient',
        amount: Number(item.amount || 0),
        direction: 'out',
      }))

      const recentActivity = [...recentCollections, ...recentHandovers]
        .sort((a, b) => getDateKey(b.date).localeCompare(getDateKey(a.date)))
        .slice(0, 8)

      setData({
        dailyCash: sumAmount(todayCash),
        dailyDirect: sumAmount(todayDirect),
        dailyHandovers: sumAmount(todayHandovers),
        dailyVisits: uniqueDailyVisitors.size,
        monthlyCash: sumAmount(monthCash),
        monthlyDirect: sumAmount(monthDirect),
        monthlyHandovers: sumAmount(monthHandovers),
        cashInHand: totalCashReceived - totalHandedOver,
        recentActivity,
      })
    } catch (error) {
      console.error('Dashboard loading error:', error)
      alert('Unable to load dashboard. Please check the database.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const currentMonth = new Date().toLocaleDateString('en-LK', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <h2>Dashboard</h2>
          <p>Today's collection and cash summary</p>
        </div>

        <button
          type="button"
          className="dashboard-refresh"
          onClick={loadDashboard}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="dashboard-loading">Loading dashboard...</div>
      ) : (
        <>
          <section className="dashboard-section">
            <div className="dashboard-section-title">
              <CalendarDays size={19} />
              <h3>Today's Summary</h3>
              <span>{formatDate(dateKey())}</span>
            </div>

            <div className="dashboard-card-grid">
              <div className="dashboard-card">
                <div className="dashboard-card-icon cash-icon">
                  <Banknote size={22} />
                </div>
                <span className="dashboard-card-label">Cash Collections</span>
                <strong>{money(data.dailyCash)}</strong>
                <small>Cash received today</small>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-icon handover-icon">
                  <HandCoins size={22} />
                </div>
                <span className="dashboard-card-label">Cash Handovers</span>
                <strong>{money(data.dailyHandovers)}</strong>
                <small>Cash handed over today</small>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-icon visit-icon">
                  <Users size={22} />
                </div>
                <span className="dashboard-card-label">Customers Visited</span>
                <strong>{data.dailyVisits}</strong>
                <small>Unique customers visited today</small>
              </div>

              <div className="dashboard-card">
                <div className="dashboard-card-icon wallet-icon">
                  <Wallet size={22} />
                </div>
                <span className="dashboard-card-label">Cash in Hand</span>
                <strong>{money(data.cashInHand)}</strong>
                <small>Cash collections less handovers</small>
              </div>
            </div>

            {data.dailyDirect > 0 && (
              <div className="dashboard-info-row">
                <span>Verified company payments today</span>
                <strong>{money(data.dailyDirect)}</strong>
              </div>
            )}
          </section>

          <section className="dashboard-section">
            <div className="dashboard-section-title">
              <CalendarDays size={19} />
              <h3>Monthly Summary</h3>
              <span>{currentMonth}</span>
            </div>

            <div className="dashboard-card-grid monthly-grid">
              <div className="dashboard-card monthly-card">
                <div className="dashboard-card-icon cash-icon">
                  <ArrowDownLeft size={22} />
                </div>
                <span className="dashboard-card-label">Cash Collections</span>
                <strong>{money(data.monthlyCash)}</strong>
                <small>Total cash received this month</small>
              </div>

              <div className="dashboard-card monthly-card">
                <div className="dashboard-card-icon handover-icon">
                  <ArrowUpRight size={22} />
                </div>
                <span className="dashboard-card-label">Cash Handovers</span>
                <strong>{money(data.monthlyHandovers)}</strong>
                <small>Total handed over this month</small>
              </div>
            </div>

            {data.monthlyDirect > 0 && (
              <div className="dashboard-info-row">
                <span>Verified company payments this month</span>
                <strong>{money(data.monthlyDirect)}</strong>
              </div>
            )}
          </section>

          <section className="dashboard-section recent-section">
            <div className="dashboard-section-title">
              <h3>Recent Transactions</h3>
              <span>Latest 8</span>
            </div>

            {data.recentActivity.length === 0 ? (
              <div className="dashboard-empty">
                No transactions recorded yet.
              </div>
            ) : (
              <div className="dashboard-activity-list">
                {data.recentActivity.map((item) => (
                  <div className="dashboard-activity-item" key={item.id}>
                    <div className={`activity-direction ${item.direction}`}>
                      {item.direction === 'in'
                        ? <ArrowDownLeft size={19} />
                        : <ArrowUpRight size={19} />}
                    </div>

                    <div className="activity-details">
                      <strong>{item.name}</strong>
                      <span>{item.type} · {formatDate(item.date)}</span>
                    </div>

                    <strong className={`activity-amount ${item.direction}`}>
                      {item.direction === 'out' ? '-' : '+'}
                      {money(item.amount)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
