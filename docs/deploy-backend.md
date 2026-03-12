# 后台部署教程（含管理后台）

本文基于 Docker + Ubuntu 22.04，默认结构：
- backend（API）
- admin（后台管理界面）
- infra（nginx + compose）

## 1. 准备服务器
1. 开放端口：80、443
2. 安装依赖

```bash
sudo apt update
sudo apt install -y docker.io docker-compose
sudo systemctl enable docker
```

## 2. 配置环境变量
复制示例文件并填写：

```bash
cp backend/.env.example backend/.env
```

需要填写：
- `TPY_API_KEY`
- `CALLBACK_BASE`（如 `https://api.yourdomain.com`）
- `ADMIN_TOKEN`（后台访问口令）

## 3. 初始化数据库
启动数据库后执行迁移：

```bash
docker compose -f infra/docker-compose.yml up -d db

# 进入数据库容器
sudo docker exec -i $(docker ps -qf "name=db") psql -U postgres -d tpy < backend/migrations/001_init.sql
```

## 4. 启动全部服务

```bash
docker compose -f infra/docker-compose.yml up -d --build
```

## 5. 访问后台
- 打开 `http://你的服务器IP/`
- 输入 `ADMIN_TOKEN`
- 管理标签、查看反馈

## 6. 生产建议
- 上线时请使用 HTTPS（推荐 Nginx + Certbot）
- 回调地址必须是公网可访问
- API Key 仅保存在后端

