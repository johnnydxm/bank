'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Card } from '../ui/Card';
import { Textarea } from '../ui/Textarea';
import { useTransfer } from '../../hooks/useTransfer';
import { formatCurrency } from '../../../shared/utils/formatters';

const transferSchema = z.object({
  recipientId: z.string().min(1, 'Recipient ID is required'),
  amount: z.string().refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    'Amount must be a positive number'
  ),
  currency: z.string().min(1, 'Currency is required'),
  sourceAccountId: z.string().min(1, 'Source account is required'),
  note: z.string().optional(),
  urgency: z.enum(['standard', 'priority', 'instant']).optional()
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TransferFormProps {
  accounts: Array<{
    id: string;
    name: string;
    balance: number;
    currency: string;
  }>;
  onSuccess?: () => void;
  className?: string;
}

export const TransferForm: React.FC<TransferFormProps> = ({
  accounts,
  onSuccess,
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const { createTransfer } = useTransfer();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      recipientId: '',
      amount: '',
      currency: 'USD',
      sourceAccountId: '',
      note: '',
      urgency: 'standard'
    }
  });

  const watchedAmount = watch('amount');
  const watchedCurrency = watch('currency');
  const selectedAccountData = accounts.find(acc => acc.id === selectedAccount);

  const onSubmit = async (data: TransferFormData) => {
    setIsLoading(true);

    try {
      await createTransfer({
        fromAccountId: data.sourceAccountId,
        toUserId: data.recipientId,
        amount: Number(data.amount),
        currency: data.currency,
        description: data.note,
        urgency: data.urgency
      });

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Transfer error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const urgencyOptions = [
    { value: 'standard', label: 'Standard (Free)', description: '1-3 business days' },
    { value: 'priority', label: 'Priority ($2.99)', description: 'Same day' },
    { value: 'instant', label: 'Instant ($4.99)', description: 'Within minutes' }
  ];

  const currencyOptions = [
    { value: 'USD', label: 'USD - US Dollar' },
    { value: 'EUR', label: 'EUR - Euro' },
    { value: 'USDC', label: 'USDC - USD Coin' },
    { value: 'ETH', label: 'ETH - Ethereum' }
  ];

  return (
    <Card className={`w-full max-w-2xl mx-auto p-6 ${className}`}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Send Money
        </h2>
        <p className="text-gray-600">
          Transfer funds to another DWAY user instantly
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Source Account Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From Account
          </label>
          <Select
            {...register('sourceAccountId')}
            value={selectedAccount}
            onValueChange={(value) => {
              setSelectedAccount(value);
              register('sourceAccountId').onChange({ target: { value } });
            }}
            error={errors.sourceAccountId?.message}
            disabled={isLoading}
          >
            <option value="">Select source account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} - {formatCurrency(account.balance, account.currency)}
              </option>
            ))}
          </Select>
        </div>

        {/* Recipient ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient DWAY ID
          </label>
          <Input
            {...register('recipientId')}
            type="text"
            placeholder="@username or user ID"
            error={errors.recipientId?.message}
            disabled={isLoading}
          />
        </div>

        {/* Amount and Currency */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount
            </label>
            <Input
              {...register('amount')}
              type="number"
              step="0.01"
              placeholder="0.00"
              error={errors.amount?.message}
              disabled={isLoading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Currency
            </label>
            <Select
              {...register('currency')}
              error={errors.currency?.message}
              disabled={isLoading}
            >
              {currencyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Transfer Speed */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Transfer Speed
          </label>
          <div className="space-y-2">
            {urgencyOptions.map((option) => (
              <label key={option.value} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  {...register('urgency')}
                  type="radio"
                  value={option.value}
                  className="text-blue-600"
                />
                <div className="flex-1">
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Note (Optional)
          </label>
          <Textarea
            {...register('note')}
            placeholder="What's this transfer for?"
            rows={3}
            error={errors.note?.message}
            disabled={isLoading}
          />
        </div>

        {/* Transfer Summary */}
        {watchedAmount && watchedCurrency && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Transfer Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Amount:</span>
                <span>{formatCurrency(Number(watchedAmount), watchedCurrency)}</span>
              </div>
              {selectedAccountData && (
                <div className="flex justify-between">
                  <span>Remaining Balance:</span>
                  <span>
                    {formatCurrency(
                      selectedAccountData.balance - Number(watchedAmount),
                      selectedAccountData.currency
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
          variant="primary"
        >
          {isLoading ? (
            <>
              <Loader2 size={20} className="animate-spin mr-2" />
              Processing Transfer...
            </>
          ) : (
            <>
              <Send size={20} className="mr-2" />
              Send Transfer
            </>
          )}
        </Button>
      </form>
    </Card>
  );
};