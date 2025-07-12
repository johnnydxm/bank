'use client';

import React from 'react';

interface Account {
  id: string;
  name: string;
  balance: number;
  currency: string;
}

interface BalanceChartProps {
  accounts: Account[];
  className?: string;
}

export const BalanceChart: React.FC<BalanceChartProps> = ({
  accounts,
  className = ''
}) => {
  const totalBalance = accounts.reduce((sum, account) => sum + account.balance, 0);
  
  // Generate colors for each account
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
  ];

  // Calculate percentages and create chart data
  const chartData = accounts.map((account, index) => ({
    ...account,
    percentage: (account.balance / totalBalance) * 100,
    color: colors[index % colors.length]
  }));

  // Create SVG donut chart
  const radius = 80;
  const strokeWidth = 20;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  
  let cumulativePercentage = 0;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          {chartData.map((item, index) => {
            const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativePercentage / 100 * circumference;
            cumulativePercentage += item.percentage;
            
            return (
              <circle
                key={item.id}
                stroke={item.color}
                fill="transparent"
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
                className="transition-all duration-500 ease-in-out"
              />
            );
          })}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-gray-500">Total</div>
            <div className="text-lg font-semibold">
              {accounts.length} accounts
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 space-y-2 w-full">
        {chartData.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700 truncate">{item.name}</span>
            </div>
            <div className="text-right">
              <div className="font-medium">{item.percentage.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};