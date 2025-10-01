import express from 'express';
import { authMiddleware, getUserIdFromAuth } from '../utils/authUtils.js';
import { getUserAccount } from '../models/accountModel.js';
import { checkBalance, deductCredits } from '../models/accountModel.js';

const router = express.Router();

// 服务定价配置
const SERVICE_PRICES = {
  'ai-image-edit': 5,
  'ai-video-generate': 20
};

/**
 * 检查用户积分是否充足
 */
const checkUserBalance = async (
  userId: string,
  serviceName: string
): Promise<{ hasSufficientBalance: boolean; requiredCredits: number }> => {
  const requiredCredits = SERVICE_PRICES[serviceName as keyof typeof SERVICE_PRICES] || 0;
  // 检查用户积分余额
  const account = await getUserAccount(userId);
  const balance = account ? account.balance : 0;
  
  return {
    hasSufficientBalance: balance >= requiredCredits,
    requiredCredits
  };
};

/**
 * 处理图像编辑请求
 * 注意：这是一个示例实现，实际应用中需要集成Gemini API
 */
router.post('/edit-image', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 检查用户积分是否充足
    const { hasSufficientBalance, requiredCredits } = await checkUserBalance(userId, 'ai-image-edit');
    if (!hasSufficientBalance) {
      return res.status(402).json({
        error: 'Insufficient credits',
        requiredCredits,
        message: 'You need more credits to use this service'
      });
    }
    
    // 获取请求数据
    const { imageData, prompt } = req.body;
    
    if (!imageData || !prompt) {
      return res.status(400).json({ error: 'Image data and prompt are required' });
    }
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 扣除用户积分
    await deductCredits(userId, requiredCredits, 'Used AI Image Editing service');
    
    // 这里应该是实际调用Gemini API处理图像编辑的代码
    // 为了演示，我们返回一个模拟的成功响应
    res.status(200).json({
      success: true,
      message: 'Image edited successfully',
      // 在实际应用中，这里应该返回编辑后的图像数据
      editedImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    });
  } catch (error) {
    console.error('Error processing image edit request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 处理视频生成请求
 * 注意：这是一个示例实现，实际应用中需要集成视频生成API
 */
router.post('/generate-video', authMiddleware, async (req, res) => {
  try {
    const userId = getUserIdFromAuth(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // 检查用户积分是否充足
    const { hasSufficientBalance, requiredCredits } = await checkUserBalance(userId, 'ai-video-generate');
    if (!hasSufficientBalance) {
      return res.status(402).json({
        error: 'Insufficient credits',
        requiredCredits,
        message: 'You need more credits to use this service'
      });
    }
    
    // 获取请求数据
    const { prompt, duration } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }
    
    // 模拟处理延迟
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 扣除用户积分
    await deductCredits(userId, requiredCredits, 'Used AI Video Generation service');
    
    // 这里应该是实际调用视频生成API的代码
    // 为了演示，我们返回一个模拟的成功响应
    res.status(200).json({
      success: true,
      message: 'Video generation started',
      // 在实际应用中，这里应该返回视频生成任务的ID或状态
      taskId: `video_${Date.now()}`,
      estimatedDuration: duration || 30
    });
  } catch (error) {
    console.error('Error processing video generation request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;