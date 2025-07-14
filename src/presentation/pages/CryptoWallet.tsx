import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';

interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  balance: number;
  balanceUSD: number;
  price: number;
  change24h: number;
  logo: string;
}

interface StakePosition {
  id: string;
  asset: string;
  protocol: string;
  stakedAmount: number;
  apy: number;
  earned: number;
  status: 'active' | 'unstaking' | 'pending';
}

interface DeFiProtocol {
  id: string;
  name: string;
  logo: string;
  apy: number;
  tvl: string;
  category: 'lending' | 'staking' | 'dex' | 'yield';
}

export const CryptoWallet: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'stake' | 'swap' | 'defi'>('portfolio');
  const [assets, setAssets] = useState<CryptoAsset[]>([]);
  const [stakePositions, setStakePositions] = useState<StakePosition[]>([]);
  const [defiProtocols, setDefiProtocols] = useState<DeFiProtocol[]>([]);
  const [swapFrom, setSwapFrom] = useState('BTC');
  const [swapTo, setSwapTo] = useState('ETH');
  const [swapAmount, setSwapAmount] = useState('');
  const [totalPortfolioValue, setTotalPortfolioValue] = useState(0);

  useEffect(() => {
    // Mock crypto assets
    const mockAssets: CryptoAsset[] = [
      {
        id: 'bitcoin',
        symbol: 'BTC',
        name: 'Bitcoin',
        balance: 0.15,
        balanceUSD: 6847.50,
        price: 45650.00,
        change24h: 2.4,
        logo: '₿'
      },
      {
        id: 'ethereum',
        symbol: 'ETH',
        name: 'Ethereum',
        balance: 2.3,
        balanceUSD: 5520.00,
        price: 2400.00,
        change24h: -1.2,
        logo: 'Ξ'
      },
      {
        id: 'usdc',
        symbol: 'USDC',
        name: 'USD Coin',
        balance: 1500.00,
        balanceUSD: 1500.00,
        price: 1.00,
        change24h: 0.01,
        logo: '$'
      }
    ];

    const mockStakePositions: StakePosition[] = [
      {
        id: 'stake_1',
        asset: 'ETH',
        protocol: 'Ethereum 2.0',
        stakedAmount: 1.5,
        apy: 5.2,
        earned: 0.045,
        status: 'active'
      },
      {
        id: 'stake_2',
        asset: 'USDC',
        protocol: 'Compound',
        stakedAmount: 500,
        apy: 3.8,
        earned: 12.50,
        status: 'active'
      }
    ];

    const mockProtocols: DeFiProtocol[] = [
      {
        id: 'compound',
        name: 'Compound',
        logo: 'C',
        apy: 3.8,
        tvl: '$8.2B',
        category: 'lending'
      },
      {
        id: 'uniswap',
        name: 'Uniswap V3',
        logo: 'U',
        apy: 12.5,
        tvl: '$5.1B',
        category: 'dex'
      },
      {
        id: 'aave',
        name: 'Aave',
        logo: 'A',
        apy: 4.2,
        tvl: '$12.8B',
        category: 'lending'
      }
    ];

    setAssets(mockAssets);
    setStakePositions(mockStakePositions);
    setDefiProtocols(mockProtocols);
    setTotalPortfolioValue(mockAssets.reduce((sum, asset) => sum + asset.balanceUSD, 0));
  }, []);

  const renderPortfolio = () => (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card className="p-6">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold">${totalPortfolioValue.toLocaleString()}</h2>
          <p className="text-gray-600">Total Portfolio Value</p>
          <Badge variant="success" className="mt-2">+8.2% (24h)</Badge>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-green-600">+$642</p>
            <p className="text-sm text-gray-600">Today's Gain</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{assets.length}</p>
            <p className="text-sm text-gray-600">Assets</p>
          </div>
          <div>
            <p className="text-2xl font-bold">2</p>
            <p className="text-sm text-gray-600">Staking</p>
          </div>
        </div>
      </Card>

      {/* Asset List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Your Assets</h3>
        <div className="space-y-4">
          {assets.map(asset => (
            <div key={asset.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                  {asset.logo}
                </div>
                <div>
                  <p className="font-semibold">{asset.name}</p>
                  <p className="text-sm text-gray-600">{asset.balance} {asset.symbol}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">${asset.balanceUSD.toLocaleString()}</p>
                <p className={`text-sm ${asset.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {asset.change24h >= 0 ? '+' : ''}{asset.change24h}%
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Button className="w-full">
            <span className="mr-2">📥</span>
            Deposit
          </Button>
          <Button variant="outline" className="w-full">
            <span className="mr-2">📤</span>
            Withdraw
          </Button>
        </div>
      </Card>
    </div>
  );

  const renderStaking = () => (
    <div className="space-y-6">
      {/* Staking Overview */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Staking Overview</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-2xl font-bold">$3,600</p>
            <p className="text-gray-600">Total Staked</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">$57.50</p>
            <p className="text-gray-600">Total Earned</p>
          </div>
        </div>
      </Card>

      {/* Active Positions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Positions</h3>
        <div className="space-y-4">
          {stakePositions.map(position => (
            <div key={position.id} className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-semibold">{position.asset} Staking</p>
                  <p className="text-sm text-gray-600">{position.protocol}</p>
                </div>
                <Badge 
                  variant={position.status === 'active' ? 'success' : 'warning'}
                >
                  {position.status}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Staked</p>
                  <p className="font-medium">{position.stakedAmount} {position.asset}</p>
                </div>
                <div>
                  <p className="text-gray-600">APY</p>
                  <p className="font-medium text-green-600">{position.apy}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Earned</p>
                  <p className="font-medium">{position.earned} {position.asset}</p>
                </div>
              </div>
              <div className="mt-4 flex space-x-2">
                <Button size="sm" variant="outline">
                  Claim Rewards
                </Button>
                <Button size="sm" variant="outline">
                  Unstake
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Available Protocols */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Available Staking</h3>
        <div className="space-y-3">
          {defiProtocols.filter(p => p.category === 'lending' || p.category === 'staking').map(protocol => (
            <div key={protocol.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                  {protocol.logo}
                </div>
                <div>
                  <p className="font-medium">{protocol.name}</p>
                  <p className="text-sm text-gray-600">TVL: {protocol.tvl}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-green-600">{protocol.apy}% APY</p>
                <Button size="sm" className="mt-1">
                  Stake
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderSwap = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-6">Swap Tokens</h3>
        
        {/* From Section */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">From</label>
            <div className="flex space-x-4">
              <Select
                value={swapFrom}
                onChange={(e) => setSwapFrom(e.target.value)}
                className="w-32"
              >
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </Select>
              <Input
                type="number"
                placeholder="0.0"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                className="flex-1"
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Balance: {assets.find(a => a.symbol === swapFrom)?.balance || 0} {swapFrom}
            </p>
          </div>

          {/* Swap Direction */}
          <div className="flex justify-center">
            <button
              onClick={() => {
                const temp = swapFrom;
                setSwapFrom(swapTo);
                setSwapTo(temp);
              }}
              className="p-2 border rounded-full hover:bg-gray-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* To Section */}
          <div>
            <label className="block text-sm font-medium mb-2">To</label>
            <div className="flex space-x-4">
              <Select
                value={swapTo}
                onChange={(e) => setSwapTo(e.target.value)}
                className="w-32"
              >
                <option value="BTC">BTC</option>
                <option value="ETH">ETH</option>
                <option value="USDC">USDC</option>
              </Select>
              <Input
                type="number"
                placeholder="0.0"
                value={swapAmount ? (parseFloat(swapAmount) * 0.95).toFixed(6) : ''}
                disabled
                className="flex-1 bg-gray-50"
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">
              ≈ ${swapAmount ? (parseFloat(swapAmount) * 45650 * 0.95).toLocaleString() : '0'}
            </p>
          </div>

          {/* Swap Details */}
          {swapAmount && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Exchange Rate</span>
                <span>1 {swapFrom} = 19.02 {swapTo}</span>
              </div>
              <div className="flex justify-between">
                <span>Network Fee</span>
                <span>~$15.20</span>
              </div>
              <div className="flex justify-between">
                <span>Slippage</span>
                <span>0.5%</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-2">
                <span>You'll receive</span>
                <span>{swapAmount ? (parseFloat(swapAmount) * 0.95).toFixed(6) : '0'} {swapTo}</span>
              </div>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!swapAmount || parseFloat(swapAmount) <= 0}
          >
            {swapAmount ? `Swap ${swapFrom} for ${swapTo}` : 'Enter amount to swap'}
          </Button>
        </div>
      </Card>

      {/* Recent Swaps */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Swaps</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <span className="mr-2">🔄</span>
              <div>
                <p className="font-medium">0.1 BTC → 1.9 ETH</p>
                <p className="text-sm text-gray-600">2 hours ago</p>
              </div>
            </div>
            <Badge variant="success">Completed</Badge>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center">
              <span className="mr-2">🔄</span>
              <div>
                <p className="font-medium">500 USDC → 0.2 ETH</p>
                <p className="text-sm text-gray-600">1 day ago</p>
              </div>
            </div>
            <Badge variant="success">Completed</Badge>
          </div>
        </div>
      </Card>
    </div>
  );

  const renderDeFi = () => (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">DeFi Opportunities</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {defiProtocols.map(protocol => (
            <div key={protocol.id} className="border rounded-lg p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                    {protocol.logo}
                  </div>
                  <div>
                    <p className="font-semibold">{protocol.name}</p>
                    <Badge variant="secondary" size="sm">
                      {protocol.category}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>APY</span>
                  <span className="font-semibold text-green-600">{protocol.apy}%</span>
                </div>
                <div className="flex justify-between">
                  <span>TVL</span>
                  <span>{protocol.tvl}</span>
                </div>
              </div>
              <Button size="sm" className="w-full mt-3">
                {protocol.category === 'dex' ? 'Provide Liquidity' : 'Lend Assets'}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Yield Farming */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Yield Farming</h3>
        <div className="bg-gradient-to-r from-purple-100 to-blue-100 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold">ETH-USDC Pool</h4>
              <p className="text-gray-600">Uniswap V3 • Fee Tier: 0.3%</p>
              <p className="text-2xl font-bold text-green-600 mt-2">24.5% APY</p>
            </div>
            <Button>
              Add Liquidity
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Crypto Wallet</h1>
              <p className="text-gray-600 mt-1">Manage your digital assets and DeFi investments</p>
            </div>
            <div className="flex space-x-4">
              <Button variant="outline">
                Connect Wallet
              </Button>
              <Button>
                + Add Asset
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { id: 'portfolio', name: 'Portfolio', icon: '💼' },
              { id: 'stake', name: 'Staking', icon: '🏦' },
              { id: 'swap', name: 'Swap', icon: '🔄' },
              { id: 'defi', name: 'DeFi', icon: '⚡' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'portfolio' && renderPortfolio()}
        {activeTab === 'stake' && renderStaking()}
        {activeTab === 'swap' && renderSwap()}
        {activeTab === 'defi' && renderDeFi()}
      </main>
    </div>
  );
};