export function formatLkr(amountInMinorUnits = 0) {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
  }).format(amountInMinorUnits / 100)
}
