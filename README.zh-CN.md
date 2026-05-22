# KPL BP Panel

[English](README.md) | 中文

KPL BP Panel 是一个用于模拟 KPL BO7 Ban/Pick 流程的桌面应用。

## 功能

- 中文 KPL 风格 BO7 BP 面板。
- 第 1-6 局全局 BP 流程，并通过规则引擎校验合法性。
- 第 7 局巅峰对决盲选提交与同时揭晓。
- 本地英雄数据与英雄头像缓存。
- 支持自动保存、打开、保存和导出比赛文件。
- 支持 macOS 与 Windows 打包配置。

## 开发

```bash
npm ci
npm run dev
```

## 验证

```bash
npm run test
npm run typecheck
npm run build
```

## 打包

macOS 本地包：

```bash
npm run package:mac
```

macOS 签名包：

```bash
npm run package:mac:signed
```

macOS 签名并公证的发布包：

```bash
npm run package:mac:release
```

Windows 包：

```bash
npm run package:win
```

签名、公证和发布验证细节见 [docs/testing-and-packaging.md](docs/testing-and-packaging.md)。

## 资源说明

英雄数据和英雄头像属于腾讯/王者荣耀相关资源。本项目仅将其作为本地缓存的游戏参考数据使用，不代表与腾讯或 KPL 存在官方关联。
