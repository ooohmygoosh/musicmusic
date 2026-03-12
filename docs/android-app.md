# 安卓端最小可用 App

## 1. 安装依赖
```bash
cd app
npm install
```

## 2. 运行
```bash
npm run android
```

## 3. 配置 API 地址
默认 Android 模拟器地址是 `10.0.2.2`。如需修改：
- `app/app.json` 中 `extra.apiBase`
- 或使用环境变量 `EXPO_PUBLIC_API_BASE`

## 4. 必需后端接口
- `GET /tags`
- `POST /users`
- `POST /init-tags`
- `POST /generate`
- `GET /songs?user_id=...`
- `POST /feedback`

