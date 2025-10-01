import { openDb } from '../db/db.js';
import type { Payment } from '../../types.js';
import crypto from 'crypto';
import { depositCredits } from './accountModel.js';

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 创建支付记录
 */
export const createPayment = async (
  userId: string,
  amount: number,
  method: 'wechat' | 'alipay' | 'other',
  creditsRate: number = 10 // 1元 = 10积分
): Promise<Payment> => {
  const db = await openDb();
  const id = generateId();
  const credits = amount * creditsRate;
  const now = new Date().toISOString();
  
  await db.run(
    'INSERT INTO payments (id, userId, amount, credits, status, method, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    id, userId, amount, credits, 'pending', method, now, now
  );
  
  return {
    id,
    userId,
    amount,
    credits,
    status: 'pending',
    method,
    createdAt: new Date(now),
    updatedAt: new Date(now)
  };
};

/**
 * 获取支付记录
 */
export const getPaymentById = async (id: string): Promise<Payment | null> => {
  const db = await openDb();
  const row = await db.get('SELECT * FROM payments WHERE id = ?', id);
  
  if (!row) return null;
  
  return {
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    credits: row.credits,
    status: row.status as 'pending' | 'completed' | 'failed' | 'refunded',
    method: row.method as 'wechat' | 'alipay' | 'other',
    transactionId: row.transactionId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
};

/**
 * 获取用户支付记录
 */
export const getUserPayments = async (
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<Payment[]> => {
  const db = await openDb();
  const rows = await db.all(
    'SELECT * FROM payments WHERE userId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?',
    userId, limit, offset
  );
  
  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    amount: row.amount,
    credits: row.credits,
    status: row.status as 'pending' | 'completed' | 'failed' | 'refunded',
    method: row.method as 'wechat' | 'alipay' | 'other',
    transactionId: row.transactionId,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  }));
};

/**
 * 更新支付状态
 */
export const updatePaymentStatus = async (
  paymentId: string,
  status: 'completed' | 'failed' | 'refunded',
  transactionId?: string
): Promise<boolean> => {
  const db = await openDb();
  
  // 开始事务
  await db.run('BEGIN TRANSACTION');
  
  try {
    // 获取支付记录
    const payment = await getPaymentById(paymentId);
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // 检查当前状态是否为pending
    if (payment.status !== 'pending') {
      throw new Error('Payment is not pending');
    }
    
    const now = new Date().toISOString();
    
    // 更新支付状态
    await db.run(
      'UPDATE payments SET status = ?, transactionId = ?, updatedAt = ? WHERE id = ?',
      status, transactionId, now, paymentId
    );
    
    // 如果支付成功，充值积分
    if (status === 'completed') {
      await depositCredits(payment.userId, payment.credits, paymentId, `充值${payment.credits}积分`);
    }
    
    // 提交事务
    await db.run('COMMIT');
    
    return true;
  } catch (error) {
    // 回滚事务
    await db.run('ROLLBACK');
    console.error('Failed to update payment status:', error);
    return false;
  }
};

/**
 * 处理支付回调
 */
export const handlePaymentCallback = async (
  paymentId: string,
  transactionId: string,
  success: boolean
): Promise<boolean> => {
  return updatePaymentStatus(
    paymentId,
    success ? 'completed' : 'failed',
    transactionId
  );
};

/**
 * 获取支付网关URL（模拟）
 */
export const getPaymentGatewayUrl = async (
  paymentId: string,
  method: 'wechat' | 'alipay' | 'other'
): Promise<string> => {
  // 实际实现中应该调用相应支付网关的API
  // 这里只是模拟返回一个支付URL
  return `https://payment-gateway.example.com/pay?paymentId=${paymentId}&method=${method}`;
};