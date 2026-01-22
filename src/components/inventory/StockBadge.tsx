import { cn } from '@/lib/utils';
import { StockStatus } from '@/types/inventory';

interface StockBadgeProps {
  status: StockStatus;
  stock?: number;
}

export function StockBadge({ status, stock }: StockBadgeProps) {
  return (
    <span className={cn(
      status === 'in-stock' && 'stock-badge-high',
      status === 'low-stock' && 'stock-badge-low',
      status === 'out-of-stock' && 'stock-badge-out'
    )}>
      {status === 'in-stock' && 'In Stock'}
      {status === 'low-stock' && 'Low Stock'}
      {status === 'out-of-stock' && 'Out of Stock'}
      {stock !== undefined && ` (${stock})`}
    </span>
  );
}
