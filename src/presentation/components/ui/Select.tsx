'use client';

import React from 'react';
import { cn } from '../../../shared/utils/classNames';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string | undefined;
  label?: string | undefined;
  helperText?: string | undefined;
  children: React.ReactNode;
  value?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  options?: Array<{value: string; label: string}> | undefined;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, label, helperText, children, value, onValueChange, options, ...props }, ref) => {
    const selectClasses = cn(
      'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50',
      error && 'border-red-500 focus:ring-red-500',
      className
    );

    return (
      <div className="space-y-1">
        {label && (
          <label className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <select
          className={selectClasses}
          ref={ref}
          value={value}
          onChange={(e) => onValueChange?.(e.target.value)}
          {...props}
        >
          {options ? options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          )) : children}
        </select>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-gray-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';