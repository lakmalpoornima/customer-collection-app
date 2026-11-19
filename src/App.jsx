import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetails from './pages/CustomerDetails'
import CashCollection from './pages/CashCollection'
import CompanyPayments from './pages/CompanyPayments'
import CashHandover from './pages/CashHandover'
import Reports from './pages/Reports'


export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:customerId" element={<CustomerDetails />} />
        <Route path="/cash-collections" element={<CashCollection />} />
        <Route path="/company-payments" element={<CompanyPayments />} />
        <Route path="/cash-handovers" element={<CashHandover />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
