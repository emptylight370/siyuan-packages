// IRes* 返回类型是 ambient 全局声明，用类型语义导入使其进入消费方编译程序（构建期被擦除，
// 打包器不会尝试解析 .d.ts）。本 lib 不做独立 tsc 检查：api.ts 引用的 NotebookId/Notebook/Block
// 等基础类型仍由各插件包 src/types/index.d.ts 提供，待基础类型抽取进 lib 后再独立校验。
import type {} from './types/api';

export * from './api';
