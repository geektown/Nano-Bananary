import express from 'express';
import {
  getUserAccount,
  getUserTransactions,
  checkBalance
} from '../models/accountModel.js';
import { authMiddleware, getUserIdFromAuth } from '../utils/authUtils.js';

const router = express.Router();

// 获取用户积分账户信息
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const account = await getUserAccount(userId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    res.status(200).json(account);
  } catch (error) {
    console.error('Error fetching user account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取用户积分交易记录
router.get('/transactions', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { limit = '50', offset = '0' } = req.query;
    
    const transactions = await getUserTransactions(
      userId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 检查用户积分余额是否充足
router.get('/check-balance/:amount', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { amount } = req.params;
    const requiredAmount = parseFloat(amount);
    if (isNaN(requiredAmount) || requiredAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const hasEnoughBalance = await checkBalance(userId, requiredAmount);
    const account = await getUserAccount(userId);
    
    res.status(200).json({
      hasEnoughBalance,
      currentBalance: account?.balance || 0,
      requiredAmount
    });
  } catch (error) {
    console.error('Error checking balance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取积分规则配置
router.get('/rules', async (req, res) => {
  try {
    // 实际应用中可以从配置文件或数据库读取规则
    const rules = {
      exchangeRate: 10, // 1元 = 10积分
      expirationDays: 365, // 积分有效期1年
      minimumBalance: 0, // 最低余额
      maxTransferAmount: 1000, // 最大转账金额
      servicePricing: {
        'ai-image-edit': 5,
        'ai-image-generate': 10,
        'high-resolution-edit': 15,
        'batch-processing': 20,
        'remove-background': 3,
        'enhance-image': 4,
        'resize-image': 2
      }
    };
    
    res.status(200).json(rules);
  } catch (error) {
    console.error('Error fetching account rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 积分即将过期提醒（模拟）
router.get('/expiration-alerts', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 实际应用中应该查询即将过期的积分
    // 这里只是返回模拟数据
    const alerts = {
      hasExpiringCredits: false,
      expiringAmount: 0,
      expirationDate: null
    };
    
    res.status(200).json(alerts);
  } catch (error) {
    console.error('Error fetching expiration alerts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;