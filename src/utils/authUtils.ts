import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getUserById } from '../models/userModel.js';
import type { User } from '../../types.js';

// JWT密钥 - 在实际环境中应该从环境变量中获取
const JWT_SECRET = 'your-secret-key'; // 在生产环境中应使用环境变量
const JWT_EXPIRATION = '24h';

/**
 * 生成JWT令牌
 */
export const generateAuthToken = (user: User): string => {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    isVerified: user.isVerified
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRATION
  });
};

/**
 * 验证JWT令牌
 */
export const verifyAuthToken = (token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded);
      }
    });
  });
};

/**
 * 认证中间件
 * 验证请求中的JWT令牌并将用户信息附加到请求对象
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 从Authorization头获取令牌
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res.status(401).json({ error: 'Authorization header is required' });
      return;
    }

    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
      res.status(401).json({ error: 'Invalid authorization format' });
      return;
    }

    // 验证令牌
    const decoded = await verifyAuthToken(token);
    const user = await getUserById(decoded.userId);

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // 将用户信息附加到请求对象
    (req as any).user = user;
    (req as any).token = token;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
    } else if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
    } else {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

/**
 * 从请求中获取用户ID
 */
export const getUserIdFromAuth = (req: Request): string | null => {
  return (req as any).user?.id || null;
};

/**
 * 检查用户是否已认证
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!((req as any).user);
};