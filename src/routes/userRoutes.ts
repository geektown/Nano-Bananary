import express from 'express';
import {
  createUser,
  getUserByEmail,
  getUserByUsername,
  verifyPassword,
  verifyUserEmail,
  updateUserPassword,
  resetUserPassword,
  getLoginAttempts,
  incrementLoginAttempts,
  resetLoginAttempts
} from '../models/userModel.js';
import { generateAuthToken, authMiddleware } from '../utils/authUtils.js';
import type { User } from '../../types.js';

const router = express.Router();

// 注册新用户
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, phone } = req.body;
    
    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    
    // 验证密码强度
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      });
    }
    
    // 检查用户是否已存在
    const existingUserByEmail = await getUserByEmail(email);
    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email already in use' });
    }
    
    const existingUserByUsername = await getUserByUsername(username);
    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username already in use' });
    }
    
    // 创建用户
    const user = await createUser(username, email, password, phone);
    
    // 生成JWT令牌
    const token = generateAuthToken(user);
    
    // 发送验证邮件（在实际应用中实现）
    // sendVerificationEmail(user.email, user.verificationToken);
    
    res.status(201).json({
      message: 'User created successfully.',
      userId: user.id,
      token: token
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 用户登录
router.post('/login', async (req, res) => {
  try {
    const { username, password, captcha } = req.body;
    
    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // 检查登录尝试次数
    const attempts = await getLoginAttempts(username);
    
    // 如果尝试次数超过限制，要求输入验证码
    if (attempts >= 3 && !captcha) {
      return res.status(400).json({ 
        error: 'Too many failed attempts. Please enter captcha.',
        requireCaptcha: true
      });
    }
    
    // 验证码验证（在实际应用中实现）
    // if (attempts >= 3 && !validateCaptcha(captcha)) {
    //   return res.status(400).json({ error: 'Invalid captcha' });
    // }
    
    // 查找用户
    let user = await getUserByUsername(username);
    if (!user) {
      user = await getUserByEmail(username);
    }
    
    if (!user) {
      await incrementLoginAttempts(username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // 验证密码
    const passwordMatch = verifyPassword(password, user.passwordHash, user.salt);
    
    if (!passwordMatch) {
      await incrementLoginAttempts(username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    // 检查账户是否已验证
    if (!user.isVerified) {
      // return res.status(403).json({ error: 'Please verify your email before logging in' });
    }
    
    // 重置登录尝试次数
    await resetLoginAttempts(username);
    
    // 生成JWT令牌
    const token = generateAuthToken(user);

    res.status(200).json({
      message: 'Login successful',
      userId: user.id,
      username: user.username,
      email: user.email,
      token: token
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 验证邮箱
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const success = await verifyUserEmail(token);
    
    if (success) {
      res.status(200).json({ message: 'Email verified successfully' });
    } else {
      res.status(400).json({ error: 'Invalid or expired verification token' });
    }
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 修改密码
router.post('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    
    // 验证输入
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // 验证新密码强度
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      });
    }
    
    const success = await updateUserPassword(userId, currentPassword, newPassword);
    
    if (success) {
      res.status(200).json({ message: 'Password updated successfully' });
    } else {
      res.status(400).json({ error: 'Current password is incorrect' });
    }
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 重置密码
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    // 验证输入
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and new password are required' });
    }
    
    // 验证新密码强度
    if (!isStrongPassword(newPassword)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
      });
    }
    
    const success = await resetUserPassword(email, newPassword);
    
    if (success) {
      res.status(200).json({ message: 'Password reset successfully' });
    } else {
      res.status(404).json({ error: 'User not found with this email' });
    }
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = (req as any).user as User;
    
    // 返回用户信息，但不包含敏感信息
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      phone: user.phone,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };
    
    res.status(200).json(userResponse);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 辅助函数：验证密码强度
const isStrongPassword = (password: string): boolean => {
  // 至少8位，包含大小写字母、数字和特殊字符
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

export default router;