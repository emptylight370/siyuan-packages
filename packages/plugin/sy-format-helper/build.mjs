import { context } from 'esbuild';
import * as sass from 'sass';
import JSZip from 'jszip';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const pkgDir = import.meta.dirname;
const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const distDir = path.join(pkgDir, 'dist');
const outDir = isProd ? distDir : pkgDir;
const zipPath = path.join(pkgDir, 'package.zip');

// 把 sass 编译结果交给 esbuild 处理，使其能像 css 一样被 import 并输出独立文件
const sassPlugin = {
    name: 'sass',
    setup(build) {
        build.onLoad({ filter: /\.scss$/ }, async (args) => {
            const result = await sass.compileAsync(args.path, {
                style: isProd ? 'compressed' : 'expanded',
            });
            return { contents: result.css, loader: 'css' };
        });
    },
};

async function copyAssets() {
    const names = (await fs.readdir(pkgDir)).filter(
        (name) =>
            name === 'icon.png' || name === 'preview.png' || name === 'plugin.json' || /^README.*\.md$/.test(name),
    );
    await Promise.all(names.map((name) => fs.copyFile(path.join(pkgDir, name), path.join(outDir, name))));
    await fs.cp(path.join(pkgDir, 'src', 'i18n'), path.join(outDir, 'i18n'), { recursive: true });
}

async function createPackageZip() {
    const zip = new JSZip();
    const addDir = async (dir) => {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await addDir(full);
                continue;
            }
            const relative = path.relative(distDir, full).split(path.sep).join('/');
            zip.file(relative, await fs.readFile(full));
        }
    };
    await addDir(distDir);
    const buffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 },
    });
    await fs.writeFile(zipPath, buffer);
    console.log(`package.zip ${(buffer.length / 1024).toFixed(1)} KiB`);
}

async function main() {
    if (isProd) {
        await fs.rm(distDir, { recursive: true, force: true });
        await fs.rm(zipPath, { force: true });
        await fs.mkdir(distDir, { recursive: true });
    }

    await copyAssets();

    const ctx = await context({
        entryPoints: [path.join(pkgDir, 'src', 'index.ts')],
        outfile: path.join(outDir, 'index.js'),
        bundle: true,
        format: 'cjs',
        target: 'es6',
        platform: 'browser',
        external: ['siyuan'],
        minify: isProd,
        sourcemap: isProd ? false : 'inline',
        legalComments: 'none',
        banner: isProd ? { js: await fs.readFile(path.join(pkgDir, 'LICENSE'), 'utf8') } : undefined,
        plugins: [sassPlugin],
        logLevel: 'info',
    });

    if (isWatch) {
        await ctx.watch();
        console.log('watching...');
        return;
    }

    await ctx.rebuild();
    await ctx.dispose();

    if (isProd) {
        await createPackageZip();
    }
}

await main();
