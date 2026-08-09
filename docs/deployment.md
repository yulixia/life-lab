# 人生实验室 MVP 部署说明

## 构建

```bash
npm install
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

产物位于 `dist/`，可部署到任意静态托管服务。应用无服务端、无数据库、无登录和同步依赖。

## 运行要求

- Node.js: 24.14.0 或更高，见 `.node-version`
- 存储：浏览器 `localStorage`
- 路由：静态托管需回退到 `index.html`

## 隐私边界

- 核心数据只保存在当前浏览器的 `life-lab:v1`
- 完整 JSON 导出包含用户正文内容
- 匿名摘要只包含计数，不包含标题、事件、原因、观察或标签文本
