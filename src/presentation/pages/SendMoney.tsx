import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { CurrencyConverter } from '../components/currency/CurrencyConverter';
import { useTransfer } from '../hooks/useTransfer';

interface Contact {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  lastTransfer?: string;
}

interface UserAccount {
  id: string;
  name: string;
  currency: string;
  balance: number;
  formattedBalance: string;
}

export const SendMoney: React.FC = () => {
  const [step, setStep] = useState<'recipient' | 'amount' | 'review' | 'success'>('recipient');
  const [selectedRecipient, setSelectedRecipient] = useState<Contact | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedAccount, setSelectedAccount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [recentContacts, setRecentContacts] = useState<Contact[]>([]);
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [exchangeRate, setExchangeRate] = useState(1);

  const { createTransfer, isLoading, error } = useTransfer();

  // Mock data
  useEffect(() => {
    const mockContacts: Contact[] = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        avatar: 'JD',
        lastTransfer: '2025-07-10'
      },
      {
        id: '2',
        name: 'Sarah Wilson',
        email: 'sarah.wilson@example.com',
        avatar: 'SW',
        lastTransfer: '2025-07-08'
      },
      {
        id: '3',
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        avatar: 'MJ',
        lastTransfer: '2025-07-05'
      }
    ];

    const mockAccounts: UserAccount[] = [
      {
        id: 'acc_1',
        name: 'Main Checking',
        currency: 'USD',
        balance: 5420.50,
        formattedBalance: '$5,420.50'
      },
      {
        id: 'acc_2',
        name: 'Euro Savings',
        currency: 'EUR',
        balance: 2800.00,
        formattedBalance: '€2,800.00'
      },
      {
        id: 'acc_3',
        name: 'Crypto Wallet',
        currency: 'BTC',
        balance: 0.15,
        formattedBalance: '0.15 BTC'
      }
    ];

    setRecentContacts(mockContacts);
    setUserAccounts(mockAccounts);
    setSelectedAccount(mockAccounts[0]?.id || '');
  }, []);

  const handleSendMoney = async () => {
    if (!selectedRecipient && !recipientEmail) return;
    if (!amount || !selectedAccount) return;

    const transferData = {
      fromAccountId: selectedAccount,
      toUserId: selectedRecipient?.email || recipientEmail,
      amount: parseFloat(amount),
      currency,
      description: note,
      urgency: isUrgent ? 'instant' : 'standard' as 'instant' | 'standard'
    };

    try {
      await createTransfer(transferData);
      setStep('success');
    } catch (err) {
      console.error('Transfer failed:', err);
    }
  };

  const getCurrentBalance = () => {
    const account = userAccounts.find(acc => acc.id === selectedAccount);
    return account?.formattedBalance || '$0.00';
  };

  const getSelectedCurrency = () => {
    const account = userAccounts.find(acc => acc.id === selectedAccount);
    return account?.currency || 'USD';
  };

  const renderRecipientStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Send Money</h2>
        <p className="text-gray-600">Choose a recipient or enter their email</p>
      </div>

      {/* Recent Contacts */}
      <div>
        <h3 className="font-medium mb-3">Recent Contacts</h3>
        <div className="space-y-2">
          {recentContacts.map(contact => (
            <div
              key={contact.id}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedRecipient?.id === contact.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setSelectedRecipient(contact)}
            >
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium mr-3">
                  {contact.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-gray-500">{contact.email}</p>
                </div>
                {contact.lastTransfer && (
                  <Badge variant="secondary" size="sm">
                    Last: {new Date(contact.lastTransfer).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manual Email Entry */}
      <div>
        <h3 className="font-medium mb-3">Or enter email manually</h3>
        <Input
          type="email"
          placeholder="recipient@example.com"
          value={recipientEmail}
          onChange={(e) => {
            setRecipientEmail(e.target.value);
            setSelectedRecipient(null);
          }}
          className="w-full"
        />
      </div>

      <Button
        onClick={() => setStep('amount')}
        disabled={!selectedRecipient && !recipientEmail}
        className="w-full"
      >
        Continue
      </Button>
    </div>
  );

  const renderAmountStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Enter Amount</h2>
        <p className="text-gray-600">
          Sending to: {selectedRecipient?.name || recipientEmail}
        </p>
      </div>

      {/* Account Selection */}
      <div>
        <label className="block font-medium mb-2">From Account</label>
        <Select
          value={selectedAccount}
          onChange={(e) => {
            setSelectedAccount(e.target.value);
            setCurrency(getSelectedCurrency());
          }}
        >
          {userAccounts.map(account => (
            <option key={account.id} value={account.id}>
              {account.name} - {account.formattedBalance}
            </option>
          ))}
        </Select>
        <p className="text-sm text-gray-500 mt-1">
          Available balance: {getCurrentBalance()}
        </p>
      </div>

      {/* Amount Input */}
      <div>
        <label className="block font-medium mb-2">Amount</label>
        <div className="relative">
          <Input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-2xl font-bold pr-16"
          />
          <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">
            {getSelectedCurrency()}
          </span>
        </div>
      </div>

      {/* Currency Converter */}
      {getSelectedCurrency() !== 'USD' && (
        <CurrencyConverter
          userId="current-user"
        />
      )}

      {/* Transfer Options */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Standard Transfer</p>
            <p className="text-sm text-gray-500">1-3 business days • Free</p>
          </div>
          <input
            type="radio"
            name="transferSpeed"
            checked={!isUrgent}
            onChange={() => setIsUrgent(false)}
          />
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">Instant Transfer</p>
            <p className="text-sm text-gray-500">Within minutes • $2.99 fee</p>
          </div>
          <input
            type="radio"
            name="transferSpeed"
            checked={isUrgent}
            onChange={() => setIsUrgent(true)}
          />
        </div>
      </div>

      {/* Note */}
      <div>
        <label className="block font-medium mb-2">Note (Optional)</label>
        <Input
          placeholder="What's this for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      <div className="flex space-x-4">
        <Button
          variant="outline"
          onClick={() => setStep('recipient')}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={() => setStep('review')}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex-1"
        >
          Review
        </Button>
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Review Transfer</h2>
        <p className="text-gray-600">Please confirm the details below</p>
      </div>

      <Card className="p-6 space-y-4">
        <div className="flex justify-between">
          <span className="text-gray-600">Recipient</span>
          <span className="font-medium">{selectedRecipient?.name || recipientEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Email</span>
          <span>{selectedRecipient?.email || recipientEmail}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Amount</span>
          <span className="font-medium text-lg">{amount} {getSelectedCurrency()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">From Account</span>
          <span>{userAccounts.find(acc => acc.id === selectedAccount)?.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Transfer Speed</span>
          <span>{isUrgent ? 'Instant (+$2.99)' : 'Standard (Free)'}</span>
        </div>
        {note && (
          <div className="flex justify-between">
            <span className="text-gray-600">Note</span>
            <span className="text-right max-w-48">{note}</span>
          </div>
        )}
        <div className="border-t pt-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${(parseFloat(amount) + (isUrgent ? 2.99 : 0)).toFixed(2)}</span>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="flex space-x-4">
        <Button
          variant="outline"
          onClick={() => setStep('amount')}
          className="flex-1"
        >
          Back
        </Button>
        <Button
          onClick={handleSendMoney}
          disabled={isLoading}
          className="flex-1"
        >
          {isLoading ? 'Sending...' : 'Send Money'}
        </Button>
      </div>
    </div>
  );

  const renderSuccessStep = () => (
    <div className="text-center space-y-6">
      <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto">
        <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-2">Transfer Sent!</h2>
        <p className="text-gray-600">
          {amount} {getSelectedCurrency()} has been sent to {selectedRecipient?.name || recipientEmail}
        </p>
      </div>

      <Card className="p-6 text-left">
        <h3 className="font-medium mb-3">Transfer Details</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Transfer ID</span>
            <span className="font-mono">TXN-{Date.now()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Status</span>
            <Badge variant="warning">Processing</Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Expected Arrival</span>
            <span>{isUrgent ? 'Within minutes' : '1-3 business days'}</span>
          </div>
        </div>
      </Card>

      <div className="flex space-x-4">
        <Button
          variant="outline"
          onClick={() => {
            setStep('recipient');
            setSelectedRecipient(null);
            setRecipientEmail('');
            setAmount('');
            setNote('');
          }}
          className="flex-1"
        >
          Send Another
        </Button>
        <Button
          onClick={() => window.history.back()}
          className="flex-1"
        >
          Back to Dashboard
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center">
            <button
              onClick={() => window.history.back()}
              className="mr-4 p-2 rounded-full hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold">Send Money</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card className="p-8">
          {step === 'recipient' && renderRecipientStep()}
          {step === 'amount' && renderAmountStep()}
          {step === 'review' && renderReviewStep()}
          {step === 'success' && renderSuccessStep()}
        </Card>
      </main>
    </div>
  );
};