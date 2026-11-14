// 通用插件包构建脚本（esbuild 类型）：在 packages/<type>/<pkg> 目录下运行（pnpm --filter <pkg> build 的 cwd 即包目录）
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolvePluginMeta } from './plugin-meta.mjs';

const pkgDir = process.cwd();

// 构建依赖装在各自包内（pnpm 严格模式），因此从包目录解析而不是从脚本所在位置
const requireFromPackage = createRequire(path.join(pkgDir, 'package.json'));

let esbuildModule;
let jszipModule;
let sassModule;

function requireFromPackageOrThrow(name) {
    try {
        return requireFromPackage(name);
    } catch (error) {
        throw new Error(`当前包没有安装 ${name}，请先执行 pnpm install`, { cause: error });
    }
}

function getEsbuild() {
    if (!esbuildModule) {
        esbuildModule = requireFromPackageOrThrow('esbuild');
    }
    return esbuildModule;
}

function getJSZip() {
    if (!jszipModule) {
        jszipModule = requireFromPackageOrThrow('jszip');
    }
    return jszipModule;
}

// sass 仅在有 .scss 引入时才需要，避免纯静态包被迫安装
function getSass() {
    if (!sassModule) {
        sassModule = requireFromPackageOrThrow('sass');
    }
    return sassModule;
}

const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const distDir = path.join(pkgDir, 'dist');
// development 输出到包根，便于直接软链到思源插件目录调试
const outDir = isProd ? distDir : pkgDir;
const zipPath = path.join(pkgDir, 'package.zip');

// 把 sass 编译结果交给 esbuild 处理，使其能像 css 一样被 import 并输出独立文件
const sassPlugin = {
    name: 'sass',
    setup(build) {
        build.onLoad({ filter: /\.scss$/ }, async (args) => {
            const result = await getSass().compileAsync(args.path, {
                style: isProd ? 'compressed' : 'expanded',
            });
            return { contents: result.css, loader: 'css' };
        });
    },
};

async function exists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function readLicense() {
    try {
        return await fs.readFile(path.join(pkgDir, 'LICENSE'), 'utf8');
    } catch (error) {
        throw new Error('包目录缺少 LICENSE，无法注入许可证声明', { cause: error });
    }
}

async function copyAssets() {
    const names = (await fs.readdir(pkgDir)).filter(
        (name) => name === 'icon.png' || name === 'preview.png' || /^README.*\.md$/.test(name),
    );
    await Promise.all(names.map((name) => fs.copyFile(path.join(pkgDir, name), path.join(outDir, name))));

    const i18nDir = path.join(pkgDir, 'src', 'i18n');
    if (await exists(i18nDir)) {
        await fs.cp(i18nDir, path.join(outDir, 'i18n'), { recursive: true });
    }
}

async function createPackageZip() {
    const zip = new (getJSZip())();
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

    // 元数据在资源复制之后合成，因此资源校验以输出目录为准
    const { meta, metaFile } = await resolvePluginMeta({ pkgDir, assetDir: outDir });
    await fs.writeFile(path.join(outDir, metaFile), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`${metaFile} ${meta.name}@${meta.version}`);

    const { context } = getEsbuild();
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
        banner: isProd ? { js: await readLicense() } : undefined,
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

try {
    await main();
} catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
}
