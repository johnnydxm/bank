'use client';

import React from 'react';
import { cn } from '../../../shared/utils/classNames';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined' | undefined;
  padding?: 'none' | 'sm' | 'md' | 'lg' | undefined;
  children: React.ReactNode;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-white border border-gray-200 rounded-lg',
      elevated: 'bg-white shadow-lg rounded-lg border-0',
      outlined: 'bg-transparent border-2 border-gray-300 rounded-lg'
    };
    
    const paddings = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6'
    };

    return (
      <div
        ref={ref}
        className={cn(variants[variant], paddings[padding], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';