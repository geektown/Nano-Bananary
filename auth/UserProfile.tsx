import React, { useState, useEffect } from 'react';
import { useAuth } from './authContext';
import { useTranslation } from '../i18n/context';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ isOpen, onClose }) => {
  const { user, logout, getBalance, addCredit } = useAuth();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);
  const [creditAmount, setCreditAmount] = useState<number>(100);

  // Fetch user balance when component mounts or user changes
  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoadingBalance(true);
        const userBalance = await getBalance();
        setBalance(userBalance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      } finally {
        setLoadingBalance(false);
      }
    };

    if (user) {
      fetchBalance();
    }
  }, [user, getBalance]);

  const handleLogout = () => {
    if (window.confirm(t('auth.confirmLogout'))) {
      logout();
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAddCredit = async () => {
    try {
      const success = await addCredit(creditAmount);
      if (success) {
        // 在实际环境中，用户会被重定向到支付网关
        // 在开发环境中，我们显示一个提示
        if (process.env.NODE_ENV === 'development') {
          alert(t('auth.paymentInitiatedDev'));
          // 在开发环境中，我们提供一个手动刷新余额的选项
          if (window.confirm(t('auth.refreshBalanceConfirm'))) {
            const updatedBalance = await getBalance();
            setBalance(updatedBalance);
          }
        } else {
          // 在生产环境中，用户会被重定向到支付网关
          // 这里的代码不会执行到，因为重定向已经发生
          alert(t('auth.paymentInitiated'));
        }
      } else {
        alert(t('auth.creditAddedFailed'));
      }
    } catch (error) {
      console.error('Error adding credit:', error);
      alert(t('auth.creditAddedFailed'));
    }
  };

  // 添加一个手动刷新余额的方法
  const handleRefreshBalance = async () => {
    try {
      setLoadingBalance(true);
      const updatedBalance = await getBalance();
      setBalance(updatedBalance);
    } catch (error) {
      console.error('Error refreshing balance:', error);
      alert(t('auth.refreshBalanceFailed'));
    } finally {
      setLoadingBalance(false);
    }
  };

  // If not open or no user, don't render
  if (!isOpen || !user) return null;

  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-[var(--bg-card-alpha)] backdrop-blur-lg rounded-xl border border-[var(--border-primary)] shadow-2xl shadow-black/20 w-full max-w-md p-6 sm:p-8 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-[var(--accent-primary)]">{t('auth.profile')}</h2>
          <button 
            onClick={onClose}
            className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-secondary)] flex items-center justify-center text-white text-3xl font-bold mb-4">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <h3 className="text-xl font-semibold text-[var(--text-primary)]">{user.username}</h3>
            <p className="text-[var(--text-secondary)]">{user.email}</p>
          </div>

          <div className="bg-[var(--bg-secondary)] p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--text-secondary)]">{t('auth.registered')}</span>
              <span className="text-sm text-[var(--text-primary)]">
                {new Date(user.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-[var(--text-secondary)]">{t('auth.credits')}</span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[var(--accent-primary)]">
                  {loadingBalance ? '...' : balance}
                </span>
                <button
                  onClick={handleRefreshBalance}
                  disabled={loadingBalance}
                  className="p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label={t('auth.refreshBalance')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                {t('auth.creditAmount')}
              </label>
              <select
                value={creditAmount}
                onChange={(e) => setCreditAmount(Number(e.target.value))}
                className="w-full px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                <option value="100">100 {t('auth.credits')}</option>
                <option value="500">500 {t('auth.credits')}</option>
                <option value="1000">1000 {t('auth.credits')}</option>
              </select>
            </div>
            
            <button
              onClick={handleAddCredit}
              className="w-full py-3 px-4 bg-[var(--accent-primary)] text-white font-semibold rounded-lg hover:bg-[var(--accent-secondary)] transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('auth.addCredits')}</span>
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="w-full py-3 px-4 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{t('auth.logout')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;