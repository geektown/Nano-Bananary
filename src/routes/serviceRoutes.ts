import express from 'express';
import { authMiddleware, getUserIdFromAuth } from '../utils/authUtils.js';
import { getUserAccount } from '../models/accountModel.js';
import { checkBalance, deductCredits } from '../models/accountModel.js';
import { editImage as geminiEditImage } from '../../services/geminiService.js';
import type { GeneratedContent } from '../../types';

const router = express.Router();

// 服务定价配置
const SERVICE_PRICES = {
  'ai-image-edit': 3
};

/**
 * 检查用户积分是否充足
 */
const checkUserBalance = async (
  userId: string,
  serviceName: string
): Promise<{ hasSufficientBalance: boolean; requiredCredits: number }> => {
  const requiredCredits = SERVICE_PRICES[serviceName as keyof typeof SERVICE_PRICES] || 0;
  // 使用 checkBalance 函数检查用户积分
  const hasSufficientBalance = await checkBalance(userId, requiredCredits);
  
  return {
    hasSufficientBalance,
    requiredCredits
  };
};

/**
 * 处理图像编辑请求
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
    const { base64ImageData, mimeType, prompt, maskBase64, secondaryImage, isTwoStep, stepTwoPrompt } = req.body;
    
    if (!base64ImageData || !mimeType || !prompt) {
      return res.status(400).json({ error: 'Image data, MIME type and prompt are required' });
    }
    
    let result: GeneratedContent;
    
    if (isTwoStep && stepTwoPrompt) {
      // 两步处理流程
      // 第一步：生成线条艺术
      const stepOneResult: GeneratedContent = await geminiEditImage(
        base64ImageData, 
        mimeType, 
        prompt,
        null,
        null
      );
      
      if (!stepOneResult.imageUrl) {
        throw new Error("Step 1 (line art) failed to generate an image.");
      }
      
      // 第二步：应用第二步提示
      const stepOneImageBase64 = stepOneResult.imageUrl.split(',')[1];
      const stepOneImageMimeType = stepOneResult.imageUrl.split(';')[0].split(':')[1] || 'image/png';
      
      const stepTwoResult: GeneratedContent = await geminiEditImage(
        stepOneImageBase64, 
        stepOneImageMimeType, 
        stepTwoPrompt,
        null,
        secondaryImage || null
      );
      
      // 合并结果，保留第一步的图像作为secondaryImageUrl
      result = { 
        ...stepTwoResult, 
        secondaryImageUrl: stepOneResult.imageUrl 
      };
    } else {
      // 标准一步处理流程
      result = await geminiEditImage(
        base64ImageData, 
        mimeType, 
        prompt,
        maskBase64 || null,
        secondaryImage || null
      );
    }
    
    // 扣除用户积分
    await deductCredits(userId, requiredCredits, 'Used AI Image Editing service');
    
    res.status(200).json({
      success: true,
      message: 'Image edited successfully',
      result
    });
  } catch (error) {
    console.error('Error processing image edit request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



export default router;