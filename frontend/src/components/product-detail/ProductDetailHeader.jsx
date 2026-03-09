import { Link } from 'react-router-dom';
import { Button } from '../ui/Button.jsx';

export function ProductDetailHeader({ product, onBack, isAdmin, onDelete }) {
  return (
    <div className="mb-8">
      <button onClick={onBack} className="text-blue-600 hover:text-blue-700 mb-4">
        ← Back to Products
      </button>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">{product.name}</h1>
          <p className="text-gray-600">
            Company:{' '}
            <Link to={`/companies/${product.company.id}`} className="text-blue-600 hover:text-blue-700">
              {product.company?.name || '—'}
            </Link>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button variant="danger" onClick={onDelete}>
              Delete Product
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
