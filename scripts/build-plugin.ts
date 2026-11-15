// 通用插件包构建脚本（esbuild 类型）：在 packages/<type>/<pkg> 目录下运行（pnpm --filter <pkg> build 的 cwd 即包目录）
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { assertAssets, resolvePluginMeta, type PluginMeta } from './plugin-meta.ts';

const pkgDir = process.cwd();

// 构建依赖装在各自包内（pnpm 严格模式），因此从包目录解析而不是从脚本所在位置
const requireFromPackage = createRequire(path.join(pkgDir, 'package.json'));

// scripts/ 解析不到包内 devDependencies 的类型声明，这里只声明用到的最小形状
interface EsbuildContext {
    rebuild(): Promise<unknown>;
    watch(): Promise<unknown>;
    dispose(): Promise<unknown>;
}

interface EsbuildModule {
    context(options: Record<string, unknown>): Promise<EsbuildContext>;
}

interface SassModule {
    compileAsync(path: string, options: { style: string }): Promise<{ css: string }>;
}

interface JSZipInstance {
    file(name: string, data: Buffer): void;
    generateAsync(options: {
        type: 'nodebuffer';
        compression: 'DEFLATE';
        compressionOptions: { level: number };
    }): Promise<Buffer>;
}

let esbuildModule: EsbuildModule | undefined;
let jszipModule: (new () => JSZipInstance) | undefined;
let sassModule: SassModule | undefined;

function requireFromPackageOrThrow<T>(name: string): T {
    try {
        return requireFromPackage(name) as T;
    } catch (error) {
        throw new Error(`当前包没有安装 ${name}，请先执行 pnpm install`, { cause: error });
    }
}

function getEsbuild(): EsbuildModule {
    if (!esbuildModule) {
        esbuildModule = requireFromPackageOrThrow<EsbuildModule>('esbuild');
    }
    return esbuildModule;
}

function getJSZip(): new () => JSZipInstance {
    if (!jszipModule) {
        jszipModule = requireFromPackageOrThrow<new () => JSZipInstance>('jszip');
    }
    return jszipModule;
}

// sass 仅在有 .scss 引入时才需要，避免纯静态包被迫安装
function getSass(): SassModule {
    if (!sassModule) {
        sassModule = requireFromPackageOrThrow<SassModule>('sass');
    }
    return sassModule;
}

const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const distDir = path.join(pkgDir, 'dist');
// development 输出到包根，便于直接软链到思源插件目录调试
const outDir = isProd ? distDir : pkgDir;
const zipPath = path.join(pkgDir, 'package.zip');

interface EsbuildSassPlugin {
    name: string;
    setup(build: {
        onLoad(
            options: { filter: RegExp },
            callback: (args: { path: string }) => Promise<{ contents: string; loader: string }>,
        ): void;
    }): void;
}

// 把 sass 编译结果交给 esbuild 处理，使其能像 css 一样被 import 并输出独立文件
const sassPlugin: EsbuildSassPlugin = {
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

async function exists(target: string) {
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

// LICENSE 必须包成 /*! ... */ 块注释（与官方 plugin-sample 产物一致）：裸文本会让产物
// 成为非法 JS（Node require 直接语法错误），且 CSS 产物也需要同样的声明；
// 内容中的 */ 转义为 * / 防止注释提前闭合
function asLegalComment(text: string) {
    const body = text.trim().replaceAll('*/', '* /').replaceAll('\r\n', '\n');
    return `/*!\n * ${body.split('\n').join('\n * ')}\n */\n`;
}

async function copyAssets(meta: PluginMeta) {
    const names = (await fs.readdir(pkgDir)).filter(
        (name) => name === 'icon.png' || name === 'preview.png' || /^README.*\.md$/.test(name),
    );
    await Promise.all(names.map((name) => fs.copyFile(path.join(pkgDir, name), path.join(outDir, name))));

    const i18nDir = path.join(pkgDir, 'src', 'i18n');
    if (await exists(i18nDir)) {
        await fs.cp(i18nDir, path.join(outDir, 'i18n'), { recursive: true });
    }

    // publish.resources：集市可发布的额外资源（meta.json 声明、resolvePluginMeta 已校验存在于包目录）。
    // 目录条目（以 / 结尾）整树复制，文件条目单文件复制，均保持声明路径的相对结构；
    // dev 模式 outDir 即包根，源目标相同则跳过
    for (const resource of meta.publish?.resources ?? []) {
        const source = path.join(pkgDir, resource);
        const target = path.join(outDir, resource);
        if (path.resolve(source) === path.resolve(target)) {
            continue;
        }
        if (resource.endsWith('/')) {
            await fs.cp(source, target, { recursive: true });
        } else {
            await fs.mkdir(path.dirname(target), { recursive: true });
            await fs.copyFile(source, target);
        }
    }
}

async function createPackageZip() {
    const zip = new (getJSZip())();
    const addDir = async (dir: string) => {
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

    // 先以包目录为资产基准解析元数据，取得 publish.resources 供资源复制
    const { meta, metaFile } = await resolvePluginMeta({ pkgDir });

    await copyAssets(meta);

    // 资源复制完成后以输出目录复验（readme/icon/preview/publish.resources 必须都能在 dist 中找到）
    await assertAssets(meta, outDir);

    await fs.writeFile(path.join(outDir, metaFile), `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`${metaFile} ${meta.name}@${meta.version}`);

    const { context } = getEsbuild();
    const ctx = await context({
        entryPoints: [path.join(pkgDir, 'src', 'index.ts')],
        outfile: path.join(outDir, 'index.js'),
        bundle: true,
        format: 'cjs',
        // 思源桌面端用 latest-2 的 Electron，移动端 webview 最低 Chrome 95，产物语法按此目标保留
        target: 'chrome95',
        platform: 'browser',
        // siyuan 为运行时依赖；'../plugins/*' 让 CSS 里引用思源插件挂载路径（如 loadPetals 注入样式
        // 中 ../plugins/<pkg>/fonts/ 的字体）的 url() 保持原样输出，不在构建期解析或打包。
        // 注意不能用 '../*'：该通配会使 esbuild 0.28 静默丢弃整个 CSS 产物（实测）
        external: ['siyuan', '../plugins/*'],
        minify: isProd,
        sourcemap: isProd ? false : 'inline',
        legalComments: 'none',
        banner: isProd
            ? { js: asLegalComment(await readLicense()), css: asLegalComment(await readLicense()) }
            : undefined,
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
    console.error(`::error::${(error as Error).message}`);
    process.exit(1);
}
