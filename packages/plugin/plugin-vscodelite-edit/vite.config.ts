import vue from '@vitejs/plugin-vue';
import fg from 'fast-glob';
import minimist from 'minimist';
import livereload from 'rollup-plugin-livereload';
import { defineConfig, loadEnv } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import zipPack from 'vite-plugin-zip-pack';

import { createPluginViteConfig } from '../../../scripts/vite-plugin-config.ts';

// 公共配置在根 scripts/vite-plugin-config.ts；scripts/ 解析不到包内 devDependencies，
// vite 辅助与插件实例必须由包内传入，本文件只保留 pkgDir 与包级差异
export default createPluginViteConfig({
    pkgDir: import.meta.dirname,
    deps: { defineConfig, loadEnv, vue, fg, minimist, livereload, viteStaticCopy, zipPack },
});
