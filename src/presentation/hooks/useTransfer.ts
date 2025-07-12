'use client';

import { useState, useCallback } from 'react';
import { TransactionType } from '../../domains/banking/entities/Transaction';

interface CreateTransferRequest {
  fromAccountId: string;
  toUserId: string;
  amount: number;
  currency: string;
  description?: string | undefined;
  urgency?: 'standard' | 'priority' | 'instant' | undefined;
}

interface Transfer {
  id: string;
  fromAccountId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  description?: string | undefined;
  urgency: 'standard' | 'priority' | 'instant';
  createdAt: Date;
  estimatedCompletion?: Date | undefined;
}

export const useTransfer = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTransfer = useCallback(async (request: CreateTransferRequest): Promise<Transfer> => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Implement actual transfer creation with backend
      const response = await fetch('/api/transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error('Transfer creation failed');
      }

      const transfer = await response.json();
      return transfer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transfer failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTransferStatus = useCallback(async (transferId: string): Promise<Transfer> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transfers/${transferId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transfer status');
      }

      const transfer = await response.json();
      return transfer;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get transfer status';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const cancelTransfer = useCallback(async (transferId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/transfers/${transferId}/cancel`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to cancel transfer');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel transfer';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTransfers = useCallback(async (accountId?: string | undefined): Promise<Transfer[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const url = accountId ? `/api/transfers?accountId=${accountId}` : '/api/transfers';
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch transfers');
      }

      const transfers = await response.json();
      return transfers;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch transfers';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createTransfer,
    getTransferStatus,
    cancelTransfer,
    getTransfers
  };
};