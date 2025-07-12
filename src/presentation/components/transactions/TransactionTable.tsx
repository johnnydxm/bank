'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Search, Filter, Download } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { formatCurrency, formatDateTime } from '../../../shared/utils/formatters';
import { TransactionStatus, TransactionType } from '../../../domains/banking/entities/Transaction';

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  description: string;
  fromAccount?: string;
  toAccount?: string;
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

interface TransactionTableProps {
  transactions: Transaction[];
  isLoading?: boolean;
  onExport?: () => void;
  className?: string;
}

type SortField = 'createdAt' | 'amount' | 'status' | 'type';
type SortDirection = 'asc' | 'desc';

export const TransactionTable: React.FC<TransactionTableProps> = ({
  transactions,
  isLoading = false,
  onExport,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<TransactionType | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter(transaction => {
      const matchesSearch = transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           transaction.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || transaction.status === filterStatus;
      const matchesType = filterType === 'all' || transaction.type === filterType;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getStatusColor = (status: TransactionStatus): string => {
    switch (status) {
      case TransactionStatus.COMPLETED:
        return 'bg-green-100 text-green-800 border-green-200';
      case TransactionStatus.PENDING:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case TransactionStatus.PROCESSING:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case TransactionStatus.FAILED:
        return 'bg-red-100 text-red-800 border-red-200';
      case TransactionStatus.CANCELLED:
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: TransactionType): string => {
    switch (type) {
      case TransactionType.P2P_TRANSFER:
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case TransactionType.DEPOSIT:
        return 'bg-green-100 text-green-800 border-green-200';
      case TransactionType.WITHDRAWAL:
        return 'bg-red-100 text-red-800 border-red-200';
      case TransactionType.CURRENCY_CONVERSION:
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case TransactionType.CARD_PAYMENT:
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const SortableHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field && (
          sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        )}
      </div>
    </th>
  );

  if (isLoading) {
    return (
      <Card className={`p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Transaction History
        </h2>
        {onExport && (
          <Button onClick={onExport} variant="outline" size="sm">
            <Download size={16} className="mr-2" />
            Export
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select
          value={filterStatus}
          onChange={(value) => setFilterStatus(value as TransactionStatus | 'all')}
        >
          <option value="all">All Statuses</option>
          {Object.values(TransactionStatus).map(status => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </Select>
        <Select
          value={filterType}
          onChange={(value) => setFilterType(value as TransactionType | 'all')}
        >
          <option value="all">All Types</option>
          {Object.values(TransactionType).map(type => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ')}
            </option>
          ))}
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader field="createdAt">Date</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <SortableHeader field="type">Type</SortableHeader>
              <SortableHeader field="amount">Amount</SortableHeader>
              <SortableHeader field="status">Status</SortableHeader>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => (
              <React.Fragment key={transaction.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDateTime(transaction.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                      {transaction.description}
                    </div>
                    <div className="text-sm text-gray-500">
                      ID: {transaction.id.slice(-8)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getTypeColor(transaction.type)}>
                      {transaction.type.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={transaction.type === TransactionType.WITHDRAWAL ? 'text-red-600' : 'text-green-600'}>
                      {transaction.type === TransactionType.WITHDRAWAL ? '-' : '+'}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={getStatusColor(transaction.status)}>
                      {transaction.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Button
                      onClick={() => setExpandedRow(expandedRow === transaction.id ? null : transaction.id)}
                      variant="ghost"
                      size="sm"
                    >
                      {expandedRow === transaction.id ? 'Hide' : 'Show'}
                    </Button>
                  </td>
                </tr>
                {expandedRow === transaction.id && (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 bg-gray-50">
                      <div className="text-sm space-y-2">
                        {transaction.fromAccount && (
                          <div><strong>From:</strong> {transaction.fromAccount}</div>
                        )}
                        {transaction.toAccount && (
                          <div><strong>To:</strong> {transaction.toAccount}</div>
                        )}
                        {transaction.completedAt && (
                          <div><strong>Completed:</strong> {formatDateTime(transaction.completedAt)}</div>
                        )}
                        {transaction.metadata && Object.keys(transaction.metadata).length > 0 && (
                          <div>
                            <strong>Additional Info:</strong>
                            <pre className="text-xs mt-1 bg-white p-2 rounded border overflow-x-auto">
                              {JSON.stringify(transaction.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {filteredTransactions.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-lg mb-2">No transactions found</div>
          <div className="text-gray-500 text-sm">
            {searchTerm || filterStatus !== 'all' || filterType !== 'all'
              ? 'Try adjusting your filters'
              : 'Your transaction history will appear here'
            }
          </div>
        </div>
      )}
    </Card>
  );
};