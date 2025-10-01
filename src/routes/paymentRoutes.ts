import express from 'express';
import {
  createPayment,
  getPaymentById,
  getUserPayments,
  handlePaymentCallback,
  getPaymentGatewayUrl
} from '../models/paymentModel.js';
import { authMiddleware, getUserIdFromAuth } from '../utils/authUtils.js';

const router = express.Router();

// 创建支付订单
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { amount, method } = req.body;
    
    // 验证输入
    if (!amount || !method) {
      return res.status(400).json({ error: 'Amount and payment method are required' });
    }
    
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    // 验证支付方式
    if (!['wechat', 'alipay', 'other'].includes(method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }
    
    // 创建支付记录
    const payment = await createPayment(
      userId,
      paymentAmount,
      method as 'wechat' | 'alipay' | 'other'
    );
    
    // 获取支付网关URL
    const paymentUrl = await getPaymentGatewayUrl(payment.id, method as 'wechat' | 'alipay' | 'other');
    
    res.status(201).json({
      message: 'Payment created successfully',
      paymentId: payment.id,
      amount: payment.amount,
      credits: payment.credits,
      paymentUrl,
      status: payment.status
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取支付订单详情
router.get('/:paymentId', authMiddleware, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = getUserIdFromAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const payment = await getPaymentById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // 确保用户只能查看自己的支付订单
    if (payment.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    res.status(200).json(payment);
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取用户支付记录
router.get('/user', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { limit = '50', offset = '0', status } = req.query;
    
    // 查询用户支付记录
    let payments = await getUserPayments(
      userId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    
    // 如果指定了状态，过滤支付记录
    if (status && ['pending', 'completed', 'failed', 'refunded'].includes(status as string)) {
      payments = payments.filter(payment => payment.status === status);
    }
    
    res.status(200).json(payments);
  } catch (error) {
    console.error('Error fetching user payments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 处理支付回调（由支付网关调用）
router.post('/callback', async (req, res) => {
  try {
    // 验证请求签名（在实际应用中实现）
    // if (!verifyCallbackSignature(req)) {
    //   return res.status(401).json({ error: 'Invalid signature' });
    // }
    
    const { paymentId, transactionId, success } = req.body;
    
    // 验证输入
    if (!paymentId || !transactionId === undefined) {
      return res.status(400).json({ error: 'Payment ID and transaction status are required' });
    }
    
    // 处理支付结果
    const result = await handlePaymentCallback(paymentId, transactionId, success);
    
    if (result) {
      res.status(200).json({ message: 'Payment callback processed successfully' });
    } else {
      res.status(400).json({ error: 'Failed to process payment callback' });
    }
  } catch (error) {
    console.error('Error processing payment callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取支付网关配置
router.get('/gateway-config', async (req, res) => {
  try {
    // 实际应用中可以从配置文件读取
    const config = {
      supportedMethods: ['wechat', 'alipay'],
      currencies: ['CNY'],
      minAmount: 0.01,
      maxAmount: 10000,
      paymentExpiryMinutes: 30
    };
    
    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching payment gateway config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 模拟支付成功（用于测试）
router.post('/:paymentId/simulate-success', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const mockTransactionId = `txn_${Date.now()}`;
    
    const result = await handlePaymentCallback(paymentId, mockTransactionId, true);
    
    if (result) {
      res.status(200).json({ 
        message: 'Payment simulated successfully',
        transactionId: mockTransactionId
      });
    } else {
      res.status(400).json({ error: 'Failed to simulate payment' });
    }
  } catch (error) {
    console.error('Error simulating payment success:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 模拟支付失败（用于测试）
router.post('/:paymentId/simulate-failure', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const mockTransactionId = `txn_${Date.now()}`;
    
    const result = await handlePaymentCallback(paymentId, mockTransactionId, false);
    
    if (result) {
      res.status(200).json({ 
        message: 'Payment failure simulated successfully',
        transactionId: mockTransactionId
      });
    } else {
      res.status(400).json({ error: 'Failed to simulate payment failure' });
    }
  } catch (error) {
    console.error('Error simulating payment failure:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;