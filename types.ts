

export interface Transformation {
  key: string;
  titleKey: string;
  emoji: string;
  prompt?: string;
  descriptionKey?: string;
  items?: Transformation[];
  isMultiImage?: boolean;
  isSecondaryOptional?: boolean;
  isTwoStep?: boolean;
  stepTwoPrompt?: string;
  primaryUploaderTitle?: string;
  secondaryUploaderTitle?: string;
  primaryUploaderDescription?: string;
  secondaryUploaderDescription?: string;
  isVideo?: boolean;
}

export interface GeneratedContent {
  imageUrl: string | null;
  text: string | null;
  secondaryImageUrl?: string | null;
  videoUrl?: string;
}

// 用户管理相关类型
export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  passwordHash: string;
  salt: string;
  isVerified: boolean;
  verificationToken?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserAccount {
  userId: string;
  balance: number;
  lastUpdated: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'reward' | 'expiry';
  amount: number;
  previousBalance: number;
  currentBalance: number;
  relatedOrder?: string;
  description?: string;
  createdAt: Date;
}

export interface Payment {
  id: string;
  userId: string;
  amount: number;
  credits: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: 'wechat' | 'alipay' | 'other';
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ServiceUsage {
  id: string;
  userId: string;
  serviceKey: string;
  creditsUsed: number;
  status: 'success' | 'failed';
  details?: string;
  createdAt: Date;
}