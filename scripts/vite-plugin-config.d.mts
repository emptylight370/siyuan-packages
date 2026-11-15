/**
 * vite 插件包共用配置工厂的类型声明。实现见同目录 vite-plugin-config.mjs；
 * scripts/ 不依赖 vite 及各包 devDependencies（pnpm 隔离 node_modules），相关能力由包内传入。
 */

export interface CreatePluginViteConfigOptions {
  /** 插件包目录，vite.config.ts 内传 `import.meta.dirname` */
  pkgDir: string;
  /** 包内解析的 vite 辅助函数与插件构造器（包内 import 后整体传入） */
  deps: {
    defineConfig: (config: unknown) => unknown;
    loadEnv: (mode: string, envDir: string) => Record<string, string>;
    vue: (...args: unknown[]) => unknown;
    fg: (patterns: string[]) => Promise<string[]>;
    minimist: (argv: string[]) => Record<string, unknown>;
    livereload: (dir: string) => unknown;
    viteStaticCopy: (options: unknown) => unknown;
    zipPack: (options: unknown) => unknown;
  };
  /** watch 模式额外监听的文件（相对包目录），缺省含 i18n、README、meta.json 与根 bazaar.json */
  watchFiles?: string[];
}

export function createPluginViteConfig(options: CreatePluginViteConfigOptions): unknown;
