'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import { useAuth } from '../../hooks/useAuth';

const authenticationSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(2, 'First name is required').optional(),
  lastName: z.string().min(2, 'Last name is required').optional(),
  confirmPassword: z.string().optional(),
}).refine((data) => {
  if (data.confirmPassword && data.password !== data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type AuthenticationFormData = z.infer<typeof authenticationSchema>;

interface AuthenticationFormProps {
  mode: 'signin' | 'signup';
  onSuccess?: () => void;
  className?: string;
}

export const AuthenticationForm: React.FC<AuthenticationFormProps> = ({
  mode,
  onSuccess,
  className = ''
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<AuthenticationFormData>({
    resolver: zodResolver(authenticationSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data: AuthenticationFormData) => {
    setIsLoading(true);

    try {
      if (mode === 'signup') {
        await signUp({
          email: data.email,
          password: data.password,
          firstName: data.firstName!,
          lastName: data.lastName!
        });
      } else {
        await signIn({
          email: data.email,
          password: data.password
        });
      }

      reset();
      onSuccess?.();
    } catch (error) {
      console.error('Authentication error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className={`w-full max-w-md mx-auto p-6 ${className}`}>
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-gray-600">
          {mode === 'signin'
            ? 'Sign in to access your DWAY account'
            : 'Join DWAY Financial Freedom Platform'
          }
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {mode === 'signup' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Input
                {...register('firstName')}
                type="text"
                placeholder="First Name"
                error={errors.firstName?.message}
                disabled={isLoading}
              />
            </div>
            <div>
              <Input
                {...register('lastName')}
                type="text"
                placeholder="Last Name"
                error={errors.lastName?.message}
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <Input
          {...register('email')}
          type="email"
          placeholder="Email Address"
          error={errors.email?.message}
          disabled={isLoading}
        />

        <div className="relative">
          <Input
            {...register('password')}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            error={errors.password?.message}
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {mode === 'signup' && (
          <Input
            {...register('confirmPassword')}
            type="password"
            placeholder="Confirm Password"
            error={errors.confirmPassword?.message}
            disabled={isLoading}
          />
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
              {mode === 'signin' ? 'Signing In...' : 'Creating Account...'}
            </>
          ) : (
            mode === 'signin' ? 'Sign In' : 'Create Account'
          )}
        </Button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-gray-600">
          {mode === 'signin' ? "Don't have an account?" : 'Already have an account?'}
          <button
            type="button"
            className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
            onClick={() => window.location.href = mode === 'signin' ? '/signup' : '/signin'}
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </Card>
  );
};