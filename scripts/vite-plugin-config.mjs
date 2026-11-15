// vite 插件包共用的 vite 配置工厂（vite-vue 模板包共用，包内 vite.config.ts 只保留 pkgDir 与差异项）。
// 注意：本文件位于 scripts/，pnpm 隔离的 node_modules 解析不到包内 devDependencies，
// 因此 vite 辅助函数（defineConfig/loadEnv）与插件实例必须由包内传入（deps），这里只做编排。
// 类型声明见 vite-plugin-config.d.mts。
import { resolve } from 'node:path';

import { resolvePluginMeta } from './plugin-meta.mjs';

// watch 模式额外监听的文件，相对包目录（meta.json 与 bazaar.json 变更时元数据会变，须触发重建）
const DEFAULT_WATCH_FILES = ['src/i18n/*.json', './README*.md', './meta.json', '../../../bazaar.json'];

export function createPluginViteConfig({ pkgDir, deps, watchFiles = DEFAULT_WATCH_FILES }) {
    const { defineConfig, loadEnv, vue, fg, minimist, livereload, viteStaticCopy, zipPack } = deps;
    let pluginInfo;

    const emitPluginJson = {
        name: 'emit-plugin-json',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'plugin.json',
                source: `${JSON.stringify(pluginInfo, null, 2)}\n`,
            });
        },
    };

    return defineConfig(async ({ mode }) => {
        // 元数据由 bazaar.json 的类型模板与包内 meta.json 合成，plugin.json 是构建产物而非源文件
        ({ meta: pluginInfo } = await resolvePluginMeta({ pkgDir }));
        console.log('mode=>', mode);
        const env = loadEnv(mode, pkgDir);
        const { VITE_SIYUAN_WORKSPACE_PATH } = env;
        console.log('env=>', env);

        const siyuanWorkspacePath = VITE_SIYUAN_WORKSPACE_PATH;
        let devDistDir = './dev';
        if (!siyuanWorkspacePath) {
            console.log('\nSiyuan workspace path is not set.');
        } else {
            console.log(`\nSiyuan workspace path is set:\n${siyuanWorkspacePath}`);
            devDistDir = `${siyuanWorkspacePath}/data/plugins/${pluginInfo.name}`;
        }
        console.log(`\nPlugin will build to:\n${devDistDir}`);

        const args = minimist(process.argv.slice(2));
        const isWatch = args.watch || args.w || false;
        const distDir = isWatch ? devDistDir : './dist';

        console.log();
        console.log('isWatch=>', isWatch);
        console.log('distDir=>', distDir);

        return {
            resolve: {
                alias: {
                    '@': resolve(pkgDir, 'src'),
                },
            },

            plugins: [
                vue(),
                viteStaticCopy({
                    targets: [
                        {
                            src: './README*.md',
                            dest: './',
                        },
                        {
                            src: './icon.png',
                            dest: './',
                        },
                        {
                            src: './preview.png',
                            dest: './',
                        },
                        {
                            src: './src/i18n/**',
                            dest: './i18n/',
                            rename: { stripBase: 2 },
                        },
                    ],
                }),
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
                // 输出路径：production 写 dist/，watch 时直写思源工作空间插件目录
                outDir: distDir,
                emptyOutDir: !isWatch,

                // 构建后是否生成 source map 文件
                sourcemap: false,

                // 不压缩，用于调试
                minify: !isWatch,

                lib: {
                    entry: resolve(pkgDir, 'src/index.ts'),
                    fileName: 'index',
                    formats: ['cjs'],
                },
                rollupOptions: {
                    plugins: [
                        emitPluginJson,
                        ...(isWatch
                            ? [
                                  livereload(devDistDir),
                                  {
                                      // 监听静态资源文件与元数据
                                      name: 'watch-external',
                                      async buildStart() {
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
                        assetFileNames: (assetInfo) => {
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
