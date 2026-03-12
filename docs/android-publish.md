# 安卓端发布教程（默认 React Native + Expo）

如果你计划使用 Expo，推荐 EAS Build：

## 1. 安装工具
```bash
npm install -g expo-cli eas-cli
```

## 2. 登录与初始化
```bash
eas login
cd app
expo init .
```

## 3. 配置安卓构建
`app.json` 示例：
```json
{
  "expo": {
    "name": "TPY Music",
    "slug": "tpy-music",
    "android": {
      "package": "com.yourcompany.tpymusic",
      "versionCode": 1
    }
  }
}
```

## 4. 生成安卓构建
```bash
eas build -p android --profile production
```

## 5. 上架 Google Play
1. 注册 Google Play Developer 账号
2. 创建应用
3. 上传 `AAB` 包
4. 填写隐私与内容政策
5. 提交审核

## 6. 关键配置建议
- API 地址用环境变量（开发/生产分离）
- 音频播放使用缓存
- 处理生成失败、回调延迟等情况

如果你不用 Expo：
- 使用 Android Studio 生成 `keystore`
- 在 `android/app/build.gradle` 配置签名
- `./gradlew bundleRelease` 生成 AAB

