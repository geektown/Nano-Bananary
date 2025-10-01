import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// 数据库连接实例
let dbInstance: any = null;

/**
 * 打开数据库连接
 */
export const openDb = async () => {
  if (!dbInstance) {
    dbInstance = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });
  }
  return dbInstance;
};

/**
 * 初始化数据库表结构
 */
export const initDb = async () => {
  const db = await openDb();
  
  // 创建用户表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      phone TEXT UNIQUE,
      passwordHash TEXT NOT NULL,
      salt TEXT NOT NULL,
      isVerified INTEGER NOT NULL DEFAULT 0,
      verificationToken TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
  
  // 创建用户积分账户表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      userId TEXT PRIMARY KEY,
      balance REAL NOT NULL DEFAULT 0,
      lastUpdated TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
  `);
  
  // 创建积分交易记录表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      previousBalance REAL NOT NULL,
      currentBalance REAL NOT NULL,
      relatedOrder TEXT,
      description TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
  `);
  
  // 创建支付记录表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      amount REAL NOT NULL,
      credits REAL NOT NULL,
      status TEXT NOT NULL,
      method TEXT NOT NULL,
      transactionId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
  `);
  
  // 创建服务使用记录表
  await db.exec(`
    CREATE TABLE IF NOT EXISTS service_usages (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      serviceKey TEXT NOT NULL,
      creditsUsed REAL NOT NULL,
      status TEXT NOT NULL,
      details TEXT,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
    );
  `);
  
  return db;
};

/**
 * 关闭数据库连接
 */
export const closeDb = async () => {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
};