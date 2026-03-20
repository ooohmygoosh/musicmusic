# 安卓端最小可用 App

## 1. 安装依赖
```bash
cd app
npm install
```

## 2. 本地运行（开发环境）
```bash
npm run android
```

默认会走开发地址 `http://10.0.2.2:8080`。

## 3. API 地址策略（已标准化）
优先级：
1. 环境变量 `EXPO_PUBLIC_API_BASE`
2. `app/app.json` 中 `expo.extra.apiBase`
3. 代码内 fallback（开发 `10.0.2.2`，生产 `https://api.ooooooo0hmygooooooo0sh.xyz/api`）

当前默认生产地址：`https://api.ooooooo0hmygooooooo0sh.xyz/api`

## 4. EAS 构建环境
`app/eas.json` 已配置：
- `development` -> `EXPO_PUBLIC_API_BASE=http://10.0.2.2:8080`
- `preview` -> `EXPO_PUBLIC_API_BASE=https://api.ooooooo0hmygooooooo0sh.xyz/api`
- `production` -> `EXPO_PUBLIC_API_BASE=https://api.ooooooo0hmygooooooo0sh.xyz/api`

## 5. 必需后端接口
- `GET /tags`
- `POST /users`
- `POST /init-tags`
- `POST /generate`
- `GET /songs?user_id=...`
- `POST /feedback`
