// 元数据合成共享模块：把 bazaar.json 的类型模板与包内 meta.json 合并为集市规范的 plugin.json
// 同时供 scripts/build-plugin.mjs（esbuild 构建）与包内 vite.config.ts（vite 构建）使用
import { promises as fs } from 'node:fs';
import path from 'node:path';

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

function assertPackageLayout(pkgDir) {
    if (path.basename(path.dirname(path.dirname(pkgDir))) !== 'packages') {
        throw new Error(`构建需在 packages/<type>/<pkg> 目录下运行，当前目录: ${pkgDir}`);
    }
}

// 从包目录向上查找仓库根（以 bazaar.json 为标志）
export async function findRootDir(start) {
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

async function assertAssets(meta, assetDir) {
    const readme = typeof meta.readme === 'string' ? { default: meta.readme } : (meta.readme ?? {});
    const resources = [...Object.values(readme), meta.icon, meta.preview, ...(meta.publish?.resources ?? [])];
    for (const resource of resources.filter(Boolean)) {
        if (!(await exists(path.join(assetDir, resource)))) {
            throw new Error(`元数据引用的资源不存在: ${resource}`);
        }
    }
}

/**
 * 合成插件元数据。
 * @param {object} options
 * @param {string} options.pkgDir 包目录绝对路径
 * @param {string} [options.assetDir] 校验资源存在性的目录，默认包目录（构建时传输出目录）
 * @param {string} [options.tagVersion] 期望版本，默认读 TAG_VERSION 环境变量
 */
export async function resolvePluginMeta({ pkgDir, assetDir = pkgDir, tagVersion = process.env.TAG_VERSION }) {
    assertPackageLayout(pkgDir);

    const pkgName = path.basename(pkgDir);
    const pkgType = path.basename(path.dirname(pkgDir));
    const metaFile = `${pkgType}.json`;
    const rootDir = await findRootDir(pkgDir);

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

    await assertAssets(result, assetDir);

    return { meta: result, metaFile, pkgName, pkgType, version: meta.version, rootDir };
}
