import React, { useState, useEffect } from 'react';
import { useAuth } from './authContext';
import { useTranslation } from '../i18n/context';

interface UserProfileProps {
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, logout, getBalance } = useAuth();
  const { t } = useTranslation();
  const [balance, setBalance] = useState<number>(0);
  const [loadingBalance, setLoadingBalance] = useState<boolean>(true);

  // Fetch user balance when component mounts
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

  if (!user) return null;

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
              <span className="text-lg font-bold text-[var(--accent-primary)]">
                {loadingBalance ? '...' : balance}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              className="w-full py-3 px-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('auth.addCredits')}</span>
            </button>
            
            <button
              className="w-full py-3 px-4 bg-[var(--bg-secondary)] text-[var(--text-primary)] font-semibold rounded-lg hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{t('auth.editProfile')}</span>
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