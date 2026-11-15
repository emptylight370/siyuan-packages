// 元数据合成共享模块：把 bazaar.json 的类型模板与包内 meta.json 合并为集市规范的 plugin.json
// 同时供 scripts/build-plugin.ts（esbuild 构建）与包内 vite.config.ts（vite 构建）使用
import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface PluginMeta {
    name: string;
    url: string;
    version: string;
    author: string;
    /** 非必填：集市缺省视为全版本适用 */
    minAppVersion?: string;
    backends: string[];
    frontends: string[];
    displayName: Record<string, string>;
    description: Record<string, string>;
    readme: Record<string, string>;
    icon: string;
    preview: string;
    disabledInPublish?: boolean;
    publish?: {
        resources?: string[];
        data?: string[];
    };
    funding?: Record<string, unknown>;
    keywords?: string[];
    [key: string]: unknown;
}

export interface ResolvePluginMetaOptions {
    /** 包目录绝对路径，例如 packages/plugin/<pkg> */
    pkgDir: string;
    /** 校验资源存在性的目录，默认与 pkgDir 相同；构建时传输出目录 */
    assetDir?: string;
    /** 期望版本，默认读 TAG_VERSION 环境变量 */
    tagVersion?: string;
}

export interface ResolvedPluginMeta {
    /** 合并并派生后的元数据，可直接序列化为 plugin.json */
    meta: PluginMeta;
    /** 产物文件名，例如 plugin.json */
    metaFile: string;
    /** 包名，取目录名 */
    pkgName: string;
    /** 包类型，取 packages/<type>/ 的目录名 */
    pkgType: string;
    /** meta.json 中的版本号 */
    version: string;
    /** 仓库根目录 */
    rootDir: string;
}

interface BazaarFile {
    owner?: string;
    types?: Record<string, Record<string, unknown>>;
}

const RESERVED_KEYS = ['name', 'url'];
// 集市不强制 minAppVersion（缺省视为全版本适用），故只推荐填写、不列入必填
const REQUIRED_FIELDS = [
    'name',
    'author',
    'url',
    'version',
    'backends',
    'frontends',
    'displayName',
    'description',
    'readme',
    'icon',
    'preview',
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

function deepMerge(base: unknown, override: unknown): unknown {
    if (!isPlainObject(base) || !isPlainObject(override)) {
        return override === undefined ? base : override;
    }
    const merged: Record<string, unknown> = { ...base };
    for (const [key, value] of Object.entries(override)) {
        merged[key] = deepMerge(base[key], value);
    }
    return merged;
}

function substitute(value: unknown, vars: Record<string, string>): unknown {
    if (typeof value === 'string') {
        return value.replace(/\$\{(\w+)\}/g, (match: string, key: string) => (key in vars ? vars[key] : match));
    }
    if (Array.isArray(value)) {
        return value.map((item) => substitute(item, vars));
    }
    if (isPlainObject(value)) {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, substitute(item, vars)]));
    }
    return value;
}

async function exists(target: string) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

async function readJson<T>(rootDir: string, file: string): Promise<T> {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8')) as T;
    } catch (error) {
        throw new Error(`读取 ${path.relative(rootDir, file)} 失败: ${(error as Error).message}`, { cause: error });
    }
}

function assertPackageLayout(pkgDir: string) {
    if (path.basename(path.dirname(path.dirname(pkgDir))) !== 'packages') {
        throw new Error(`构建需在 packages/<type>/<pkg> 目录下运行，当前目录: ${pkgDir}`);
    }
}

// 从包目录向上查找仓库根（以 bazaar.json 为标志）
export async function findRootDir(start: string): Promise<string> {
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

async function assertAssets(meta: PluginMeta, assetDir: string) {
    const readme = typeof meta.readme === 'string' ? { default: meta.readme } : (meta.readme ?? {});
    const resources = [...Object.values(readme), meta.icon, meta.preview, ...(meta.publish?.resources ?? [])];
    for (const resource of resources.filter(Boolean)) {
        if (!(await exists(path.join(assetDir, resource as string)))) {
            throw new Error(`元数据引用的资源不存在: ${resource}`);
        }
    }
}

/**
 * 合成插件元数据。
 * @param options.pkgDir 包目录绝对路径
 * @param options.assetDir 校验资源存在性的目录，默认包目录（构建时传输出目录）
 * @param options.tagVersion 期望版本，默认读 TAG_VERSION 环境变量
 */
export async function resolvePluginMeta({
    pkgDir,
    assetDir = pkgDir,
    tagVersion = process.env.TAG_VERSION,
}: ResolvePluginMetaOptions): Promise<ResolvedPluginMeta> {
    assertPackageLayout(pkgDir);

    const pkgName = path.basename(pkgDir);
    const pkgType = path.basename(path.dirname(pkgDir));
    const metaFile = `${pkgType}.json`;
    const rootDir = await findRootDir(pkgDir);

    const bazaar = await readJson<BazaarFile>(rootDir, path.join(rootDir, 'bazaar.json'));
    const base = bazaar.types?.[pkgType];
    if (!base) {
        throw new Error(`bazaar.json 缺少 types.${pkgType}`);
    }
    if (!bazaar.owner) {
        throw new Error('bazaar.json 缺少 owner');
    }

    const meta = await readJson<Record<string, unknown>>(rootDir, path.join(pkgDir, 'meta.json'));
    for (const key of RESERVED_KEYS) {
        if (key in meta) {
            throw new Error(`meta.json 不应包含 ${key}，该字段由构建派生`);
        }
    }
    if (!meta.version) {
        throw new Error('meta.json 缺少 version');
    }
    const version = meta.version as string;
    if (tagVersion && tagVersion !== version) {
        throw new Error(`meta.json 的 version (${version}) 与 tag (${tagVersion}) 不一致`);
    }

    const vars = { owner: bazaar.owner, name: pkgName, version };
    const merged = substitute(deepMerge(base, meta), vars) as Record<string, unknown>;
    delete merged.name;
    delete merged.url;

    const result = { name: pkgName, url: `https://github.com/${bazaar.owner}/${pkgName}`, ...merged } as PluginMeta;

    for (const field of REQUIRED_FIELDS) {
        const value = result[field];
        if (value === undefined || value === null || value === '') {
            throw new Error(`合并后的 ${metaFile} 缺少必填字段: ${field}`);
        }
    }

    await assertAssets(result, assetDir);

    return { meta: result, metaFile, pkgName, pkgType, version, rootDir };
}
