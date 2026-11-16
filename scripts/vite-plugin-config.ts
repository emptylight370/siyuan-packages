// vite 插件包共用的 vite 配置工厂（全部插件包共用，包内 vite.config.ts 只保留 pkgDir 与差异项）。
// 注意：本文件位于 scripts/，pnpm 隔离的 node_modules 解析不到包内 devDependencies，
// 因此 vite 辅助函数（defineConfig）与插件实例必须由包内传入（deps），这里只做编排。
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { resolve } from 'node:path';

import { parse as parseTsConfig } from 'tsconfck';

import { assertAssets, resolvePluginMeta, type PluginMeta } from './plugin-meta.ts';

// watch 模式额外监听的文件，相对包目录（meta.json 与 bazaar.json 变更时元数据会变，须触发重建）
const DEFAULT_WATCH_FILES = ['src/i18n/*.json', './README*.md', './meta.json', '../../../bazaar.json'];

export interface CreatePluginViteConfigOptions {
    /** 插件包目录，vite.config.ts 内传 `import.meta.dirname` */
    pkgDir: string;
    /** 包内解析的 vite 辅助函数与插件构造器（包内 import 后整体传入） */
    deps: {
        defineConfig: (config: unknown) => unknown;
        /** 纯 TS/TS+SCSS 包可不传；有 .vue 源码的包传 @vitejs/plugin-vue */
        vue?: (...args: unknown[]) => unknown;
        fg: (patterns: string[]) => Promise<string[]>;
        minimist: (argv: string[]) => Record<string, unknown>;
        tsconfigPaths: (options?: unknown) => unknown;
        viteStaticCopy: (options: unknown) => unknown;
        zipPack: (options: unknown) => unknown;
    };
    /** watch 模式额外监听的文件（相对包目录），缺省含 i18n、README、meta.json 与根 bazaar.json */
    watchFiles?: string[];
}

/** defineConfig 回调收到的环境对象中本工厂只关心 mode */
interface UserConfigEnv {
    mode: string;
}

/** rollup 插件 this 上下文中用到的 emitFile 形状 */
interface EmitFileArgs {
    type: string;
    fileName: string;
    source: string;
}

/** rollup bundle 产物条目的最小形状（仅需 chunk） */
interface BundleEntry {
    type: string;
    code?: string;
}

// LICENSE 必须包成 /*! ... */ 块注释（与官方 plugin-sample 产物一致）：裸文本会让产物
// 成为非法 JS（Node require 直接语法错误）；内容中的 */ 转义为 * / 防止注释提前闭合
function asLegalComment(text: string) {
    const body = text.trim().replaceAll('*/', '* /').replaceAll('\r\n', '\n');
    return `/*!\n * ${body.split('\n').join('\n * ')}\n */\n`;
}

// 语法目标与 tsconfig 对齐：tsconfck 解析包内 tsconfig.json（扁平化 extends 链、兼容 JSONC 注释，
// 与 Volar 系工具同一实现），ES2022 → es2022、ESNext → esnext；类型层与产物层单一来源、不漂移
async function resolveBuildTarget(pkgDir: string): Promise<string> {
    const file = path.join(pkgDir, 'tsconfig.json');
    if (!existsSync(file)) {
        throw new Error(`包目录缺少 tsconfig.json，无法确定构建语法目标: ${pkgDir}`);
    }
    const { tsconfig } = await parseTsConfig(file);
    const target = tsconfig.compilerOptions?.target;
    if (!target) {
        throw new Error('无法从 tsconfig 解析 compilerOptions.target，构建语法目标未知');
    }
    return target.toLowerCase();
}

export function createPluginViteConfig({
    pkgDir,
    deps,
    watchFiles = DEFAULT_WATCH_FILES,
}: CreatePluginViteConfigOptions): unknown {
    const { defineConfig, vue, fg, minimist, tsconfigPaths, viteStaticCopy, zipPack } = deps;
    let pluginInfo: PluginMeta | undefined;

    const emitPluginJson = {
        name: 'emit-plugin-json',
        generateBundle(this: { emitFile: (args: EmitFileArgs) => void }) {
            this.emitFile({
                type: 'asset',
                fileName: 'plugin.json',
                source: `${JSON.stringify(pluginInfo, null, 2)}\n`,
            });
        },
    };

    return defineConfig(async (env: UserConfigEnv) => {
        const { mode } = env;
        // 元数据由 bazaar.json 的类型模板与包内 meta.json 合成，plugin.json 是构建产物而非源文件
        ({ meta: pluginInfo } = await resolvePluginMeta({ pkgDir }));
        console.log('mode=>', mode);

        const args = minimist(process.argv.slice(2));
        const isWatch = args.watch || args.w || false;

        // LICENSE banner 仅生产构建注入，给 JS chunk 前置 /*! ... */ 块注释（与官方 plugin-sample
        // 产物一致）；CSS 产物不注入——思源加载 CSS 不需要许可证声明。
        // 不能用 rollup 原生 output.banner：vite 8 底层 rolldown 未实现该选项（实测静默不生效）
        let license: string | undefined;
        if (!isWatch) {
            try {
                license = asLegalComment(await fs.readFile(path.join(pkgDir, 'LICENSE'), 'utf8'));
            } catch (error) {
                throw new Error('包目录缺少 LICENSE，无法注入许可证声明', { cause: error });
            }
        }
        const licenseBanner = {
            name: 'license-banner',
            enforce: 'post',
            generateBundle(this: unknown, _options: unknown, bundle: Record<string, BundleEntry>) {
                if (!license) return;
                for (const file of Object.values(bundle)) {
                    if (file.type === 'chunk' && typeof file.code === 'string') {
                        file.code = `${license}${file.code}`;
                    }
                }
            },
        };

        console.log();
        console.log('isWatch=>', isWatch);
        // watch 与 production 一律构建到包内 dist/；调试用根任务 mise run deploy 镜像同步，
        // 或手动把 dist 内容复制/软链为思源 data/plugins/<pkg>
        console.log('distDir=>', './dist');

        return {
            plugins: [
                // '@' 等别名由 vite-tsconfig-paths 从包内 tsconfig.json 的 paths 读取（单一来源）；
                // 包内 tsconfig 必须声明所用别名
                tsconfigPaths(),
                ...(vue ? [vue()] : []),
                // icon/preview 为可选资源，按包内是否存在过滤；publish.resources（如字体包的 fonts/）
                // 为 meta.json 声明的额外发布资源，目录条目保留目录名整树复制
                viteStaticCopy({
                    targets: [
                        // readme 文件从 meta.readme 生成（字符串或 {default, zh-CN} 两种形状），
                        // 声明是唯一来源：约定式 README*.md glob 会漏复制非 README 命名的自定义 readme
                        ...(() => {
                            const readme = pluginInfo?.readme;
                            const files =
                                typeof readme === 'string' ? [readme] : [...new Set(Object.values(readme ?? {}))];
                            return files.map((file) => ({ src: `./${file}`, dest: './' }));
                        })(),
                        ...['icon.png', 'preview.png']
                            .filter((name) => existsSync(resolve(pkgDir, name)))
                            .map((name) => ({
                                src: `./${name}`,
                                dest: './',
                            })),
                        // i18n 为可选资源：无 src/i18n 的包（字体包）跳过，viteStaticCopy 对空匹配 glob 会报错
                        ...(existsSync(resolve(pkgDir, 'src/i18n'))
                            ? [
                                  {
                                      src: './src/i18n/**',
                                      dest: './i18n/',
                                      rename: { stripBase: 2 },
                                  },
                              ]
                            : []),
                        ...(pluginInfo?.publish?.resources ?? []).map((resource) => ({
                            src: resource.endsWith('/') ? `./${resource.slice(0, -1)}` : `./${resource}`,
                            dest: './',
                            structured: true,
                        })),
                    ],
                }),
                licenseBanner,
                // dist 级复验（补回原 esbuild 路线的最后一道闸）：readme/icon/preview/publish.resources
                // 必须都在 dist 中。closeBundle 在 rollupOptions.plugins 的 zipPack 之前执行，zip 前拦住
                {
                    name: 'dist-audit',
                    async closeBundle() {
                        await assertAssets(pluginInfo!, resolve(pkgDir, 'dist'));
                    },
                },
            ],

            // https://github.com/vitejs/vite/issues/1930
            // https://vitejs.dev/guide/env-and-mode.html#env-files
            // https://github.com/vitejs/vite/discussions/3058#discussioncomment-2115319
            // 在这里自定义变量
            define: {
                'process.env.DEV_MODE': `"${isWatch}"`,
                'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
            },

            build: {
                // 输出路径：watch 与 production 都写包内 dist/
                outDir: './dist',
                emptyOutDir: true,

                // 构建后是否生成 source map 文件
                sourcemap: false,

                // 不压缩，用于调试
                minify: !isWatch,

                // 语法目标与 tsconfig 的 target 对齐（当前基线 ES2022）
                target: await resolveBuildTarget(pkgDir),

                lib: {
                    entry: resolve(pkgDir, 'src/index.ts'),
                    fileName: 'index',
                    formats: ['cjs'],
                },
                rollupOptions: {
                    plugins: [
                        emitPluginJson,
                        // watch 时监听静态资源文件与元数据；production 打 zip
                        ...(isWatch
                            ? [
                                  {
                                      name: 'watch-external',
                                      async buildStart(this: { addWatchFile: (file: string) => void }) {
                                          const files = await fg(watchFiles);
                                          for (const file of files) {
                                              this.addWatchFile(file);
                                          }
                                      },
                                  },
                              ]
                            : [
                                  zipPack({
                                      inDir: './dist',
                                      outDir: './',
                                      outFileName: 'package.zip',
                                  }),
                              ]),
                    ],

                    // make sure to externalize deps that shouldn't be bundled
                    // into your library
                    external: ['siyuan', 'process'],

                    output: {
                        entryFileNames: '[name].js',
                        assetFileNames: (assetInfo: { names?: string[] }) => {
                            // 使用 names 数组替代已弃用的 name 属性
                            const names = assetInfo.names || [];
                            if (names.includes('style.css')) {
                                return 'index.css';
                            }
                            return assetInfo.names?.[0] || '[name][extname]';
                        },
                    },
                },
            },
        };
    });
}
