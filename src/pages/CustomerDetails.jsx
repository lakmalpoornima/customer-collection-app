import { useParams } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'

export default function CustomerDetails() {
  const { customerId } = useParams()
  return <PageHeader title="Customer details" description={`Customer record: ${customerId}`} />
}
