import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => void;
  getBalance: () => Promise<number>;
  addCredit: (amount: number) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated on initial load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('jwt');
        if (token) {
          setIsLoading(true);
          const response = await fetch('http://localhost:3000/api/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            setUser(userData);
          } else {
            // Token is invalid or expired, remove it
            localStorage.removeItem('jwt');
          }
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3000/api/users/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const { user: userData, token } = await response.json();
      setUser(userData);
      localStorage.setItem('jwt', token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3000/api/users/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username: name, email, password })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }

      const { user: userData, token } = await response.json();
      setUser(userData);
      localStorage.setItem('jwt', token);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('jwt');
  };

  const getBalance = async (): Promise<number> => {
    try {
      const token = localStorage.getItem('jwt');
      if (!token || !user) {
        return 0;
      }

      const response = await fetch('http://localhost:3000/api/accounts', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const account = await response.json();
        return account.balance || 0;
      }
      return 0;
    } catch (err) {
      console.error('Error getting balance:', err);
      return 0;
    }
  };

  const addCredit = async (amount: number): Promise<boolean> => {
    try {
      const token = localStorage.getItem('jwt');
      if (!token || !user) {
        return false;
      }

      // 根据后端API设计，通过创建支付订单来充值
      // 按照要求使用微信支付方式，1元=10积分
      const response = await fetch('http://localhost:3000/api/payments/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amount / 10, // 1元=10积分，所以需要将积分数量转换为金额
          method: 'wechat' // 使用微信支付方式
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // 在实际环境中，这里应该跳转到支付网关URL
        // 但由于是开发环境，我们需要特殊处理
        if (process.env.NODE_ENV === 'development') {
          // 在开发环境下，我们创建一个模拟支付成功的方式
          // 但不直接调用模拟接口，而是返回true让前端认为支付已发起
          return true;
        } else {
          // 在生产环境中，重定向到支付网关URL
          window.location.href = data.paymentUrl;
          return true;
        }
      }
      
      // 如果响应不成功，尝试获取错误信息
      const errorData = await response.json();
      console.error('Payment creation failed:', errorData);
      return false;
    } catch (err) {
      console.error('Error adding credit:', err);
      return false;
    }
  };

  return (
    <AuthContext.Provider 
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        getBalance,
        addCredit,
        isLoading,
        error
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};