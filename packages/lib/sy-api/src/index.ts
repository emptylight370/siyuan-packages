// ambient 全局声明（IRes* 返回类型与思源基础类型）分布在本包两个模块化 .d.ts 中
// （declare global 注入全局作用域），经下方类型导入进入消费方编译程序。
// 不用三斜线引用：oxlint 的 typescript/triple-slash-reference 规则禁止 path 引用。
import type {} from './types/api';
import type {} from './types/siyuan';

export * from './api';
