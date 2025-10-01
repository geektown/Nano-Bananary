import React, { useState } from 'react';
import { useAuth } from './authContext';
import { useTranslation } from '../i18n/context';
import ErrorMessage from '../components/ErrorMessage';
import LoadingSpinner from '../components/LoadingSpinner';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
  onRegisterSuccess?: () => void;
}

const RegisterModal: React.FC<RegisterModalProps> = ({ isOpen, onClose, onLoginClick, onRegisterSuccess }) => {
  const { register, isLoading, error } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);

  if (!isOpen) return null;

  // Password strength checker
  const checkPasswordStrength = (pwd: string) => {
    let strength = 0;
    
    // Length check
    if (pwd.length >= 6) strength += 3;
    
    // Contains lowercase
    if (/[a-z]/.test(pwd)) strength += 1;
    
    // Contains uppercase
    if (/[A-Z]/.test(pwd)) strength += 1;
    
    // Contains number
    if (/[0-9]/.test(pwd)) strength += 1;
    
    // Contains special character
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;
    
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    checkPasswordStrength(newPassword);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Form validation
    if (!name.trim()) {
      setFormError(t('auth.nameRequired'));
      return;
    }
    
    if (!email.trim()) {
      setFormError(t('auth.emailRequired'));
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setFormError(t('auth.invalidEmail'));
      return;
    }
    
    if (!password.trim()) {
      setFormError(t('auth.passwordRequired'));
      return;
    }

    // Check password strength
    if (passwordStrength < 3) {
      setFormError(t('auth.passwordTooWeak'));
      return;
    }

    if (password !== confirmPassword) {
      setFormError(t('auth.passwordsDontMatch'));
      return;
    }

    const success = await register(name, email, password);
    if (success) {
      // 立即通知父组件注册成功
      if (onRegisterSuccess) {
        onRegisterSuccess();
      }
      onClose();
      // Reset form fields
      setName('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setPasswordStrength(0);
      // 强制刷新页面以确保显示正确的用户登录状态
      window.location.reload();
    } else if (error) {
      setFormError(error);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Password strength indicator
  const getStrengthColor = () => {
    if (passwordStrength === 0) return 'bg-transparent';
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    if (passwordStrength <= 4) return 'bg-green-400';
    return 'bg-green-600';
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
          <h2 className="text-2xl font-bold text-[var(--accent-primary)]">{t('auth.register')}</h2>
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
              htmlFor="name" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t('auth.name')}
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors"
              placeholder="Your name"
              disabled={isLoading}
            />
          </div>

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
              onChange={handlePasswordChange}
              className="w-full p-3 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-[var(--accent-primary)] transition-colors"
              placeholder="••••••••"
              disabled={isLoading}
            />
            {password.length > 0 && (
              <div className="mt-1">
                <div className="h-1 w-full bg-gray-200 rounded-full">
                  <div 
                    className={`h-1 rounded-full transition-all duration-300 ${getStrengthColor()}`}
                    style={{ width: `${(passwordStrength / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs mt-1 text-[var(--text-secondary)]">
                  {passwordStrength === 0 && t('auth.enterPassword')}
                  {passwordStrength === 1 && t('auth.veryWeak')}
                  {passwordStrength === 2 && t('auth.weak')}
                  {passwordStrength === 3 && t('auth.medium')}
                  {passwordStrength === 4 && t('auth.strong')}
                  {passwordStrength === 5 && t('auth.veryStrong')}
                </p>
              </div>
            )}
          </div>

          <div>
            <label 
              htmlFor="confirmPassword" 
              className="block text-sm font-medium text-[var(--text-primary)] mb-1"
            >
              {t('auth.confirmPassword')}
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
                <span>{t('auth.registering')}</span>
              </>
            ) : (
              <span>{t('auth.register')}</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t('auth.alreadyHaveAccount')} 
            <button 
              onClick={onLoginClick}
              className="text-[var(--accent-primary)] hover:text-[var(--accent-primary-hover)] font-medium ml-1 transition-colors"
            >
              {t('auth.login')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default RegisterModal;