import React, { useState } from 'react';
import { useAuth } from './authContext';
import { useTranslation } from '../i18n/context';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisterClick: () => void;
  onLoginSuccess?: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onRegisterClick, onLoginSuccess }) => {
  const { login, isLoading, error } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Simple validation
    if (!email.trim()) {
      setFormError(t('auth.emailRequired'));
      return;
    }
    
    if (!password.trim()) {
      setFormError(t('auth.passwordRequired'));
      return;
    }

    const success = await login(email, password);
    if (success) {
      onClose();
      // 通知父组件登录成功
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      // Reset form fields
      setEmail('');
      setPassword('');
    } else if (error) {
      setFormError(error);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
          <h2 className="text-2xl font-bold text-[var(--accent-primary)]">{t('auth.login')}</h2>
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

        {formError && <ErrorMessage message={formError} className="mb-4" />}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t('auth.email')}
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors"
              placeholder="your@email.com"
              disabled={isLoading}
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t('auth.password')}
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors"
              placeholder="••••••••"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-[var(--text-on-accent)] font-semibold rounded-lg shadow-lg shadow-[var(--accent-shadow)] hover:from-[var(--accent-primary-hover)] hover:to-[var(--accent-secondary-hover)] disabled:bg-[var(--bg-disabled)] disabled:from-[var(--bg-disabled)] disabled:to-[var(--bg-disabled)] disabled:text-[var(--text-disabled)] disabled:shadow-none disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="small" />
                <span>{t('auth.loggingIn')}</span>
              </>
            ) : (
              <span>{t('auth.login')}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('auth.dontHaveAccount')} 
            <button 
              onClick={onRegisterClick}
              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium ml-1 transition-colors"
            >
              {t('auth.register')}
            </button>
          </p>
        </div>

        <div className="mt-4 text-center">
          <button 
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            {t('auth.forgotPassword')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;