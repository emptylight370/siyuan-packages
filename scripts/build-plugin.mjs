// 通用插件包构建脚本：在 packages/<type>/<pkg> 目录下运行（pnpm --filter <pkg> build 的 cwd 即包目录）
import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const pkgDir = process.cwd();
const pkgName = path.basename(pkgDir);
const pkgType = path.basename(path.dirname(pkgDir));

// 构建依赖装在各自包内（pnpm 严格模式），因此从包目录解析而不是从脚本所在位置
const requireFromPackage = createRequire(path.join(pkgDir, 'package.json'));

let esbuildModule;
let jszipModule;

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

const isProd = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

const distDir = path.join(pkgDir, 'dist');
// development 输出到包根，便于直接软链到思源插件目录调试
const outDir = isProd ? distDir : pkgDir;
const zipPath = path.join(pkgDir, 'package.zip');
const metaFile = `${pkgType}.json`;

const RESERVED_KEYS = ['name', 'url'];
const REQUIRED_FIELDS = [
    'name',
    'author',
    'url',
    'version',
    'minAppVersion',
    'backends',
    'frontends',
    'displayName',
    'description',
    'readme',
    'icon',
    'preview',
];

let sassModule;

// sass 仅在有 .scss 引入时才需要，避免纯静态包被迫安装
function getSass() {
    if (!sassModule) {
        sassModule = requireFromPackageOrThrow('sass');
    }
    return sassModule;
}

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

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

function deepMerge(base, override) {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }
    const merged = { ...base };
    for (const [key, value] of Object.entries(override)) {
        merged[key] = deepMerge(base[key], value);
    }
    return merged;
}

function substitute(value, vars) {
    if (typeof value === 'string') {
        return value.replace(/\$\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
    }
    if (Array.isArray(value)) {
        return value.map((item) => substitute(item, vars));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, vars)]));
    }
    return value;
}

async function exists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function readJson(rootDir, file) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch (error) {
        throw new Error(`读取 ${path.relative(rootDir, file)} 失败: ${error.message}`, { cause: error });
    }
}

async function readLicense() {
    try {
        return await fs.readFile(path.join(pkgDir, 'LICENSE'), 'utf8');
    } catch (error) {
        throw new Error('包目录缺少 LICENSE，无法注入许可证声明', { cause: error });
    }
}

function assertPackageLayout() {
    if (path.basename(path.dirname(path.dirname(pkgDir))) !== 'packages') {
        throw new Error(`构建脚本需在 packages/<type>/<pkg> 目录下运行，当前目录: ${pkgDir}`);
    }
}

// 从包目录向上查找仓库根（以 bazaar.json 为标志）
async function findRootDir(start) {
    let current = start;
    for (let depth = 0; depth < 6; depth += 1) {
        if (await exists(path.join(current, 'bazaar.json'))) {
            return current;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    throw new Error(`无法从 ${start} 定位仓库根目录（未找到 bazaar.json）`);
}

async function assertAssets(meta) {
    const readme = typeof meta.readme === 'string' ? { default: meta.readme } : (meta.readme ?? {});
    const resources = [...Object.values(readme), meta.icon, meta.preview, ...(meta.publish?.resources ?? [])];
    for (const resource of resources.filter(Boolean)) {
        if (!(await exists(path.join(outDir, resource)))) {
            throw new Error(`元数据引用的资源不存在: ${resource}`);
        }
    }
}

// 将 bazaar.json 的类型模板与包内 meta.json 合并为符合集市规范的元数据文件
async function composeMeta(rootDir) {
    const bazaar = await readJson(rootDir, path.join(rootDir, 'bazaar.json'));
    const base = bazaar.types?.[pkgType];
    if (!base) {
        throw new Error(`bazaar.json 缺少 types.${pkgType}`);
    }
    if (!bazaar.owner) {
        throw new Error('bazaar.json 缺少 owner');
    }

    const meta = await readJson(rootDir, path.join(pkgDir, 'meta.json'));
    for (const key of RESERVED_KEYS) {
        if (key in meta) {
            throw new Error(`meta.json 不应包含 ${key}，该字段由构建派生`);
        }
    }
    if (!meta.version) {
        throw new Error('meta.json 缺少 version');
    }

    const tagVersion = process.env.TAG_VERSION;
    if (tagVersion && tagVersion !== meta.version) {
        throw new Error(`meta.json 的 version (${meta.version}) 与 tag (${tagVersion}) 不一致`);
    }

    const vars = { owner: bazaar.owner, name: pkgName, version: meta.version };
    const merged = substitute(deepMerge(base, meta), vars);
    delete merged.name;
    delete merged.url;

    const result = { name: pkgName, url: `https://github.com/${bazaar.owner}/${pkgName}`, ...merged };

    for (const field of REQUIRED_FIELDS) {
        const value = result[field];
        if (value === undefined || value === null || value === '') {
            throw new Error(`合并后的 ${metaFile} 缺少必填字段: ${field}`);
        }
    }

    await assertAssets(result);
    await fs.writeFile(path.join(outDir, metaFile), `${JSON.stringify(result, null, 2)}\n`);
    return result;
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
    assertPackageLayout();
    const rootDir = await findRootDir(pkgDir);

    if (isProd) {
        await fs.rm(distDir, { recursive: true, force: true });
        await fs.rm(zipPath, { force: true });
        await fs.mkdir(distDir, { recursive: true });
    }

    await copyAssets();
    const meta = await composeMeta(rootDir);
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
