import { openDb } from '../db/db.js';
import type { User } from '../../types.js';
import crypto from 'crypto';

/**
 * 生成唯一ID
 */
const generateId = (): string => {
  return crypto.randomUUID();
};

/**
 * 生成密码盐
 */
export const generateSalt = (): string => {
  return crypto.randomBytes(16).toString('hex');
};

/**
 * 使用盐对密码进行哈希处理
 */
export const hashPassword = (password: string, salt: string): string => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
};

/**
 * 验证密码
 */
export const verifyPassword = (password: string, hash: string, salt: string): boolean => {
  const hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === hashVerify;
};

/**
 * 创建用户
 */
export const createUser = async (
  username: string,
  email: string,
  password: string,
  phone?: string
): Promise<User> => {
  const db = await openDb();
  const id = generateId();
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const now = new Date().toISOString();
  const verificationToken = generateId();
  
  // 直接设置用户为已验证状态，无需邮箱验证
  await db.run(
    'INSERT INTO users (id, username, email, phone, passwordHash, salt, isVerified, verificationToken, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    id, username, email, phone, passwordHash, salt, 1, null, now, now
  );
  
  // 创建用户积分账户
  await db.run(
    'INSERT INTO user_accounts (userId, balance, lastUpdated) VALUES (?, ?, ?)',
    id, 15, now
  );
  
  return {
    id, 
    username, 
    email, 
    phone, 
    passwordHash, 
    salt, 
    isVerified: true, 
    verificationToken: null, 
    createdAt: new Date(now), 
    updatedAt: new Date(now) 
  };
};

/**
 * 通过ID查找用户
 */
export const getUserById = async (id: string): Promise<User | null> => {
  const db = await openDb();
  const row = await db.get('SELECT * FROM users WHERE id = ?', id);
  
  if (!row) return null;
  
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    isVerified: row.isVerified === 1
  };
};

/**
 * 通过邮箱查找用户
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  const db = await openDb();
  const row = await db.get('SELECT * FROM users WHERE email = ?', email);
  
  if (!row) return null;
  
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    isVerified: row.isVerified === 1
  };
};

/**
 * 通过用户名查找用户
 */
export const getUserByUsername = async (username: string): Promise<User | null> => {
  const db = await openDb();
  const row = await db.get('SELECT * FROM users WHERE username = ?', username);
  
  if (!row) return null;
  
  return {
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    isVerified: row.isVerified === 1
  };
};

/**
 * 验证用户邮箱
 */
export const verifyUserEmail = async (token: string): Promise<boolean> => {
  const db = await openDb();
  const user = await db.get('SELECT id FROM users WHERE verificationToken = ?', token);
  
  if (!user) return false;
  
  const now = new Date().toISOString();
  await db.run(
    'UPDATE users SET isVerified = 1, verificationToken = NULL, updatedAt = ? WHERE id = ?',
    now, user.id
  );
  
  return true;
};

/**
 * 更新用户密码
 */
export const updateUserPassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> => {
  const db = await openDb();
  const user = await db.get('SELECT passwordHash, salt FROM users WHERE id = ?', userId);
  
  if (!user) return false;
  
  // 验证当前密码
  if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    return false;
  }
  
  // 更新密码
  const newSalt = generateSalt();
  const newPasswordHash = hashPassword(newPassword, newSalt);
  const now = new Date().toISOString();
  
  await db.run(
    'UPDATE users SET passwordHash = ?, salt = ?, updatedAt = ? WHERE id = ?',
    newPasswordHash, newSalt, now, userId
  );
  
  return true;
};

/**
 * 重置用户密码
 */
export const resetUserPassword = async (
  email: string,
  newPassword: string
): Promise<boolean> => {
  const db = await openDb();
  const user = await db.get('SELECT id FROM users WHERE email = ?', email);
  
  if (!user) return false;
  
  // 更新密码
  const newSalt = generateSalt();
  const newPasswordHash = hashPassword(newPassword, newSalt);
  const now = new Date().toISOString();
  
  await db.run(
    'UPDATE users SET passwordHash = ?, salt = ?, updatedAt = ? WHERE id = ?',
    newPasswordHash, newSalt, now, user.id
  );
  
  return true;
};

/**
 * 检查登录失败次数
 */
export const getLoginAttempts = async (username: string): Promise<number> => {
  // 实际实现中可以使用缓存或专门的表来存储登录尝试次数
  return 0;
};

/**
 * 增加登录失败次数
 */
export const incrementLoginAttempts = async (username: string): Promise<void> => {
  // 实际实现中可以使用缓存或专门的表来存储登录尝试次数
};

/**
 * 重置登录失败次数
 */
export const resetLoginAttempts = async (username: string): Promise<void> => {
  // 实际实现中可以使用缓存或专门的表来存储登录尝试次数
};