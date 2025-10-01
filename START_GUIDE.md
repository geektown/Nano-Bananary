# 项目启动指南

## 项目概述
这是一个前后端分离的项目，包含两个部分：
- **前端**：React 应用，使用 Vite 构建，默认运行在 5173 端口
- **后端**：Express 服务器，使用 SQLite 数据库，默认运行在 3000 端口

## 启动步骤

### 1. 安装依赖
首先确保安装了所有依赖：

```bash
npm install
```

安装完成后，项目会自动包含必要的开发工具，包括：
- `ts-node`：用于直接运行 TypeScript 文件
- `npm-run-all`：用于并行启动多个服务

### 2. 同时启动前后端服务

#### 方式一：使用两个终端（推荐）

**终端 1：启动前端服务**
```bash
npm run dev
```
前端服务将在 http://localhost:5173 启动

**终端 2：启动后端服务**
```bash
npm run start:server
```
后端服务将在 http://localhost:3000 启动

> 说明：后端服务使用 `node --loader ts-node/esm` 运行 TypeScript 文件（支持ES模块），已自动配置在 package.json 中。在 ES 模块模式下，所有的 TypeScript 导入路径都必须包含文件扩展名（如 `.js`）

#### 方式二：使用 npm-run-all 工具（更便捷）

如果希望在一个命令中同时启动两个服务，可以安装 npm-run-all 工具：

```bash
npm install -g npm-run-all
```

之后就可以用一个命令启动两个服务：

```bash
npm start
```

## 验证服务

### 前端验证
打开浏览器访问 http://localhost:5173 应该能看到应用界面

### 后端验证
访问 http://localhost:3000/api/health 应该返回状态为 "ok" 的 JSON 响应

## 常见问题

1. **连接拒绝错误** (`ERR_CONNECTION_REFUSED`)
   - 检查后端服务是否已启动
   - 确保端口 3000 没有被其他程序占用

2. **数据库初始化失败**
   - 确保 SQLite 相关依赖已正确安装
   - 检查是否有文件写入权限（用于创建数据库文件）

3. **CORS 错误**
   - 后端已配置 CORS 中间件，通常不需要额外配置
   - 如有特殊需求，可以修改 src/server.ts 中的 CORS 配置

## 环境变量（可选）

项目支持以下环境变量：
- `PORT`：设置后端服务端口（默认：3000）
- `NODE_ENV`：设置环境类型（development/production）

可以创建 .env 文件来设置这些变量：

```env
PORT=3000
NODE_ENV=development
```