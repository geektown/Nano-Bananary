import { openDb } from '../db/db.js';
import type { UserAccount, CreditTransaction } from '../../types.js';
import crypto from 'crypto';

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 获取用户积分账户
 */
export const getUserAccount = async (userId: string): Promise<UserAccount | null> => {
  const db = await openDb();
  const row = await db.get('SELECT * FROM user_accounts WHERE userId = ?', userId);
  
  if (!row) return null;
  
  return {
    userId: row.userId,
    balance: row.balance,
    lastUpdated: new Date(row.lastUpdated)
  };
};

/**
 * 更新用户积分余额
 */
export const updateUserBalance = async (
  userId: string,
  amount: number,
  type: 'deposit' | 'withdrawal' | 'reward' | 'expiry',
  description?: string,
  relatedOrder?: string
): Promise<boolean> => {
  const db = await openDb();
  
  // 开始事务
  await db.run('BEGIN TRANSACTION');
  
  try {
    // 获取当前余额
    const account = await db.get('SELECT balance FROM user_accounts WHERE userId = ?', userId);
    
    if (!account) {
      throw new Error('User account not found');
    }
    
    const previousBalance = account.balance;
    const currentBalance = previousBalance + amount;
    
    // 检查余额是否足够（针对扣款操作）
    if (type === 'withdrawal' && currentBalance < 0) {
      throw new Error('Insufficient balance');
    }
    
    // 更新账户余额
    const now = new Date().toISOString();
    await db.run(
      'UPDATE user_accounts SET balance = ?, lastUpdated = ? WHERE userId = ?',
      currentBalance, now, userId
    );
    
    // 记录交易日志
    const transactionId = generateId();
    await db.run(
      'INSERT INTO credit_transactions (id, userId, type, amount, previousBalance, currentBalance, relatedOrder, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      transactionId, userId, type, amount, previousBalance, currentBalance, relatedOrder, description, now
    );
    
    // 提交事务
    await db.run('COMMIT');
    
    return true;
  } catch (error) {
    // 回滚事务
    await db.run('ROLLBACK');
    console.error('Failed to update user balance:', error);
    return false;
  }
};

/**
 * 获取用户积分交易记录
 */
export const getUserTransactions = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<CreditTransaction[]> => {
  const db = await openDb();
  const rows = await db.all(
    'SELECT * FROM credit_transactions WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    userId, limit, offset
  );
  
  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    type: row.type as 'deposit' | 'withdrawal' | 'reward' | 'expiry',
    amount: row.amount,
    previousBalance: row.previousBalance,
    currentBalance: row.currentBalance,
    relatedOrder: row.relatedOrder,
    description: row.description,
    createdAt: new Date(row.createdAt)
  }));
};

/**
 * 获取用户积分余额
 */
export const getBalance = async (
  userId: string
): Promise<number> => {
  const account = await getUserAccount(userId);
  
  if (!account) {
    return 0;
  }
  
  return account.balance;
};

/**
 * 检查用户积分余额是否充足
 */
export const checkBalance = async (
  userId: string,
  requiredAmount: number
): Promise<boolean> => {
  const account = await getUserAccount(userId);
  
  if (!account) {
    return false;
  }
  
  return account.balance >= requiredAmount;
};

/**
 * 积分充值（内部方法）
 */
export const depositCredits = async (
  userId: string,
  amount: number,
  relatedOrder?: string,
  description?: string
): Promise<boolean> => {
  return updateUserBalance(userId, amount, 'deposit', description, relatedOrder);
};

/**
 * 积分扣除（内部方法）
 */
export const withdrawCredits = async (
  userId: string,
  amount: number,
  relatedOrder?: string,
  description?: string
): Promise<boolean> => {
  return updateUserBalance(userId, -amount, 'withdrawal', description, relatedOrder);
};

/**
 * 扣除用户积分（外部使用的方法名）
 */
export const deductCredits = withdrawCredits;

/**
 * 积分奖励（内部方法）
 */
export const rewardCredits = async (
  userId: string,
  amount: number,
  description?: string
): Promise<boolean> => {
  return updateUserBalance(userId, amount, 'reward', description);
};