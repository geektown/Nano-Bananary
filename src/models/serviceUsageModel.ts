import { openDb } from '../db/db';
import { ServiceUsage } from '../../types';
import crypto from 'crypto';
import { checkBalance, withdrawCredits } from './accountModel';

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 创建服务使用记录
 */
export const createServiceUsage = async (
  userId: string,
  serviceKey: string,
  creditsUsed: number,
  status: 'success' | 'failed',
  details?: string
): Promise<ServiceUsage> => {
  const db = await openDb();
  const id = generateId();
  const now = new Date().toISOString();
  
  await db.run(
    'INSERT INTO service_usages (id, userId, serviceKey, creditsUsed, status, details, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    id, userId, serviceKey, creditsUsed, status, details, now
  );
  
  return {
    id,
    userId,
    serviceKey,
    creditsUsed,
    status,
    details,
    createdAt: new Date(now)
  };
};

/**
 * 消费服务并扣费
 */
export const consumeService = async (
  userId: string,
  serviceKey: string,
  credits: number,
  details?: string
): Promise<{ success: boolean; message?: string; serviceUsage?: ServiceUsage }> => {
  const db = await openDb();
  
  // 开始事务
  await db.run('BEGIN TRANSACTION');
  
  try {
    // 检查积分余额是否充足
    const hasEnoughBalance = await checkBalance(userId, credits);
    
    if (!hasEnoughBalance) {
      throw new Error('Insufficient balance');
    }
    
    // 扣费
    const withdrawSuccess = await withdrawCredits(userId, credits, undefined, `使用${serviceKey}服务`);
    
    if (!withdrawSuccess) {
      throw new Error('Failed to withdraw credits');
    }
    
    // 创建服务使用记录
    const serviceUsage = await createServiceUsage(
      userId,
      serviceKey,
      credits,
      'success',
      details
    );
    
    // 提交事务
    await db.run('COMMIT');
    
    return {
      success: true,
      serviceUsage
    };
  } catch (error) {
    // 回滚事务
    await db.run('ROLLBACK');
    
    // 记录失败的服务使用
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await createServiceUsage(
      userId,
      serviceKey,
      credits,
      'failed',
      `${details || ''} - Error: ${errorMessage}`
    );
    
    console.error('Failed to consume service:', error);
    
    return {
      success: false,
      message: errorMessage
    };
  }
};

/**
 * 消费服务前确认
 */
export const confirmServiceConsumption = async (
  userId: string,
  serviceKey: string,
  credits: number
): Promise<{ canConsume: boolean; balance: number }> => {
  const account = await openDb()
    .then(db => db.get('SELECT balance FROM user_accounts WHERE userId = ?', userId));
  
  if (!account) {
    return {
      canConsume: false,
      balance: 0
    };
  }
  
  return {
    canConsume: account.balance >= credits,
    balance: account.balance
  };
};

/**
 * 获取用户服务使用记录
 */
export const getUserServiceUsages = async (
  userId: string,
  limit: number = 50,
  offset: number = 0,
  serviceKey?: string
): Promise<ServiceUsage[]> => {
  const db = await openDb();
  
  let query = 'SELECT * FROM service_usages WHERE userId = ?';
  const params: any[] = [userId];
  
  if (serviceKey) {
    query += ' AND serviceKey = ?';
    params.push(serviceKey);
  }
  
  query += ' ORDER BY createdAt DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  
  const rows = await db.all(query, ...params);
  
  return rows.map(row => ({
    id: row.id,
    userId: row.userId,
    serviceKey: row.serviceKey,
    creditsUsed: row.creditsUsed,
    status: row.status as 'success' | 'failed',
    details: row.details,
    createdAt: new Date(row.createdAt)
  }));
};

/**
 * 定义服务价格配置
 */
export const servicePricing = {
  'ai-image-edit': 5, // AI图片编辑：5积分/次
  'ai-image-generate': 10, // AI图片生成：10积分/次
  'high-resolution-edit': 15, // 高清编辑：15积分/次
  'batch-processing': 20, // 批量处理：20积分/次
  'remove-background': 3, // 移除背景：3积分/次
  'enhance-image': 4, // 图片增强：4积分/次
  'resize-image': 2 // 调整图片大小：2积分/次
};

/**
 * 获取服务价格
 */
export const getServicePrice = (serviceKey: string): number => {
  return servicePricing[serviceKey as keyof typeof servicePricing] || 0;
};

/**
 * 撤销服务消费（仅在特定条件下）
 */
export const refundServiceConsumption = async (
  serviceUsageId: string,
  reason?: string
): Promise<boolean> => {
  const db = await openDb();
  
  // 开始事务
  await db.run('BEGIN TRANSACTION');
  
  try {
    // 获取服务使用记录
    const serviceUsage = await db.get('SELECT * FROM service_usages WHERE id = ?', serviceUsageId);
    
    if (!serviceUsage || serviceUsage.status !== 'success') {
      throw new Error('Invalid service usage record');
    }
    
    // 检查服务使用时间是否在可退款期限内（例如24小时）
    const usageTime = new Date(serviceUsage.createdAt);
    const now = new Date();
    const timeDiff = now.getTime() - usageTime.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      throw new Error('Refund period expired');
    }
    
    // 退款积分
    await openDb().then(db => 
      db.run(
        'UPDATE user_accounts SET balance = balance + ?, lastUpdated = ? WHERE userId = ?',
        serviceUsage.creditsUsed, now.toISOString(), serviceUsage.userId
      )
    );
    
    // 更新服务使用记录状态
    await db.run(
      'UPDATE service_usages SET status = ? WHERE id = ?',
      'refunded', serviceUsageId
    );
    
    // 记录退款交易
    const transactionId = generateId();
    await db.run(
      'INSERT INTO credit_transactions (id, userId, type, amount, previousBalance, currentBalance, relatedOrder, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      transactionId, serviceUsage.userId, 'reward', serviceUsage.creditsUsed, 
      serviceUsage.creditsUsed - serviceUsage.creditsUsed, serviceUsage.creditsUsed, 
      serviceUsageId, `服务退款: ${serviceUsage.serviceKey} ${reason || ''}`, now.toISOString()
    );
    
    // 提交事务
    await db.run('COMMIT');
    
    return true;
  } catch (error) {
    // 回滚事务
    await db.run('ROLLBACK');
    console.error('Failed to refund service consumption:', error);
    return false;
  }
};