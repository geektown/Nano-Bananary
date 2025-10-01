#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { promisify } from 'util';

// 数据库连接配置
const DB_CONFIG = {
  filename: './database.sqlite',
  driver: sqlite3.Database
};

// 颜色常量
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

// 格式化输出
const log = (message: string) => console.log(message);
const logSuccess = (message: string) => console.log(`${COLORS.green}${message}${COLORS.reset}`);
const logError = (message: string) => console.log(`${COLORS.red}${message}${COLORS.reset}`);
const logWarning = (message: string) => console.log(`${COLORS.yellow}${message}${COLORS.reset}`);
const logInfo = (message: string) => console.log(`${COLORS.cyan}${message}${COLORS.reset}`);
const logBold = (message: string) => console.log(`${COLORS.bright}${message}${COLORS.reset}`);

/**
 * 打开数据库连接
 */
async function openDb() {
  try {
    const db = await open(DB_CONFIG);
    logSuccess('数据库连接成功！');
    return db;
  } catch (error) {
    logError(`数据库连接失败: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

/**
 * 显示所有用户信息
 */
async function listAllUsers(db: any) {
  try {
    logBold('\n===== 所有用户信息 =====');
    const users = await db.all(
      `SELECT u.id, u.username, u.email, u.phone, u.isVerified, u.createdAt, a.balance 
       FROM users u 
       LEFT JOIN user_accounts a ON u.id = a.userId 
       ORDER BY u.createdAt DESC`
    );
    
    if (users.length === 0) {
      logInfo('暂无用户记录');
      return;
    }
    
    log(`总用户数: ${users.length}`);
    users.forEach((user: any, index: number) => {
      log(`\n${index + 1}. 用户ID: ${user.id}`);
      log(`   用户名: ${user.username}`);
      log(`   邮箱: ${user.email}`);
      log(`   电话: ${user.phone || '未设置'}`);
      log(`   是否已验证: ${user.isVerified ? '是' : '否'}`);
      log(`   积分余额: ${user.balance || 0}`);
      log(`   创建时间: ${user.createdAt}`);
    });
  } catch (error) {
    logError(`查询用户信息失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 根据ID或用户名删除用户
 */
async function deleteUser(db: any, identifier: string) {
  try {
    // 检查用户是否存在
    const user = await db.get(
      `SELECT id, username, email FROM users WHERE id = ? OR username = ?`,
      [identifier, identifier]
    );
    
    if (!user) {
      logError(`未找到ID或用户名为 "${identifier}" 的用户`);
      return;
    }
    
    logWarning(`\n确认删除用户:`);
    log(`用户ID: ${user.id}`);
    log(`用户名: ${user.username}`);
    log(`邮箱: ${user.email}`);
    logWarning('此操作将删除该用户的所有相关数据，包括积分账户和交易记录！');
    
    // 使用同步方式获取用户输入确认
    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const question = promisify(readline.question).bind(readline);
    const answer = await question('请确认是否继续 (y/n): ');
    readline.close();
    
    if (answer.toLowerCase() !== 'y') {
      logInfo('已取消删除操作');
      return;
    }
    
    // 开始事务
    await db.run('BEGIN TRANSACTION');
    
    // 删除用户相关数据
    await db.run(`DELETE FROM service_usages WHERE userId = ?`, [user.id]);
    await db.run(`DELETE FROM payments WHERE userId = ?`, [user.id]);
    await db.run(`DELETE FROM credit_transactions WHERE userId = ?`, [user.id]);
    await db.run(`DELETE FROM user_accounts WHERE userId = ?`, [user.id]);
    await db.run(`DELETE FROM users WHERE id = ?`, [user.id]);
    
    // 提交事务
    await db.run('COMMIT');
    
    logSuccess(`成功删除用户: ${user.username} (${user.email})`);
  } catch (error) {
    // 发生错误时回滚事务
    await db.run('ROLLBACK').catch(() => {});
    logError(`删除用户失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 查看用户积分账户信息
 */
async function viewUserAccounts(db: any) {
  try {
    logBold('\n===== 用户积分账户信息 =====');
    const accounts = await db.all(
      `SELECT u.username, u.email, a.balance, a.lastUpdated 
       FROM user_accounts a 
       JOIN users u ON a.userId = u.id 
       ORDER BY a.balance DESC`
    );
    
    if (accounts.length === 0) {
      logInfo('暂无积分账户记录');
      return;
    }
    
    log(`总账户数: ${accounts.length}`);
    accounts.forEach((account: any, index: number) => {
      log(`\n${index + 1}. 用户名: ${account.username}`);
      log(`   邮箱: ${account.email}`);
      log(`   积分余额: ${account.balance}`);
      log(`   最后更新时间: ${account.lastUpdated}`);
    });
  } catch (error) {
    logError(`查询积分账户失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 查看数据库统计信息
 */
async function viewDatabaseStats(db: any) {
  try {
    logBold('\n===== 数据库统计信息 =====');
    
    // 用户表统计
    const userCount = await db.get(`SELECT COUNT(*) as count FROM users`);
    log(`用户总数: ${userCount.count}`);
    
    // 已验证用户统计
    const verifiedUserCount = await db.get(`SELECT COUNT(*) as count FROM users WHERE isVerified = 1`);
    log(`已验证用户数: ${verifiedUserCount.count}`);
    
    // 积分账户统计
    const accountCount = await db.get(`SELECT COUNT(*) as count FROM user_accounts`);
    log(`积分账户数: ${accountCount.count}`);
    
    // 总积分统计
    const totalCredits = await db.get(`SELECT SUM(balance) as total FROM user_accounts`);
    log(`系统总积分: ${totalCredits.total || 0}`);
    
    // 交易记录统计
    const transactionCount = await db.get(`SELECT COUNT(*) as count FROM credit_transactions`);
    log(`积分交易记录数: ${transactionCount.count}`);
    
    // 服务使用统计
    const serviceUsageCount = await db.get(`SELECT COUNT(*) as count FROM service_usages`);
    log(`服务使用记录数: ${serviceUsageCount.count}`);
    
    // 支付记录统计
    const paymentCount = await db.get(`SELECT COUNT(*) as count FROM payments`);
    log(`支付记录数: ${paymentCount.count}`);
  } catch (error) {
    logError(`查询数据库统计信息失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  logBold('\n===== 数据库维护脚本使用说明 =====');
  log('该脚本用于执行数据库维护任务，如查看用户信息、删除用户等操作。');
  log('\n使用方法:');
  log('  npm run db:maintain -- [命令] [参数]');
  log('\n可用命令:');
  log('  list-users          - 查看所有用户信息');
  log('  delete-user [id/用户名] - 根据ID或用户名删除用户');
  log('  list-accounts       - 查看所有用户积分账户信息');
  log('  stats               - 查看数据库统计信息');
  log('  help                - 显示帮助信息');
  log('\n示例:');
  log('  npm run db:maintain -- list-users');
  log('  npm run db:maintain -- delete-user john_doe');
  log('  npm run db:maintain -- stats');
}

/**
 * 主函数
 */
async function main() {
  // 显示脚本标题
  logBold('\n====================================');
  logBold('      Nano-Bananary 数据库维护工具      ');
  logBold('====================================');
  
  // 获取命令行参数
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];
  
  // 连接数据库
  const db = await openDb();
  
  try {
    // 根据命令执行相应操作
    switch (command) {
      case 'list-users':
        await listAllUsers(db);
        break;
      case 'delete-user':
        if (!param) {
          logError('请提供要删除的用户ID或用户名');
          showHelp();
        } else {
          await deleteUser(db, param);
        }
        break;
      case 'list-accounts':
        await viewUserAccounts(db);
        break;
      case 'stats':
        await viewDatabaseStats(db);
        break;
      case 'help':
      case undefined:
      case '':
        showHelp();
        break;
      default:
        logError(`未知命令: ${command}`);
        showHelp();
    }
  } finally {
    // 关闭数据库连接
    try {
      if (db) {
        await db.close();
        logSuccess('\n数据库连接已关闭');
      }
    } catch (closeError) {
      logError(`关闭数据库连接失败: ${closeError instanceof Error ? closeError.message : String(closeError)}`);
    }
  }
}

// 执行主函数
main().catch(err => {
  logError(`脚本执行失败: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});