import { promises as fs } from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(import.meta.dirname, '..');
const TAG_PATTERN = /^([^@\s]+)@([^@\s]+)$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/;

interface BazaarFile {
    owner?: string;
    types?: Record<string, unknown>;
}

interface PackageMeta {
    version?: string;
}

async function isDirectory(target: string) {
    try {
        return (await fs.stat(target)).isDirectory();
    } catch {
        // 路径不存在表示该类型下没有同名包
        return false;
    }
}

// 文件不存在时返回 null（用于识别迁移前的提交），JSON 解析失败仍然中断
async function readJson<T>(file: string): Promise<T | null> {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8')) as T;
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return null;
        }
        throw new Error(`读取 ${path.relative(rootDir, file)} 失败: ${(error as Error).message}`, { cause: error });
    }
}

interface PackageCandidate {
    type: string;
    dir: string;
}

async function findPackage(name: string): Promise<PackageCandidate[] | null> {
    const packagesDir = path.join(rootDir, 'packages');
    if (!(await isDirectory(packagesDir))) {
        return null;
    }
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });
    const candidates: PackageCandidate[] = [];
    for (const entry of entries.filter((item) => item.isDirectory())) {
        if (await isDirectory(path.join(packagesDir, entry.name, name))) {
            candidates.push({ type: entry.name, dir: `packages/${entry.name}/${name}` });
        }
    }
    return candidates;
}

async function writeOutput(output: Record<string, string | boolean>) {
    const lines = Object.entries(output)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
    if (process.env.GITHUB_OUTPUT) {
        await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines}\n`);
    }
    console.log(lines);
}

async function main() {
    const tag = process.argv[2];
    if (!tag) {
        throw new Error('用法: node scripts/parse-tag.ts <package>@<version>');
    }

    const parsed = TAG_PATTERN.exec(tag);
    if (!parsed) {
        throw new Error(`tag 格式非法: ${tag}，应为 <package>@<version>`);
    }

    const [, name, version] = parsed;
    if (!VERSION_PATTERN.test(version)) {
        throw new Error(`tag 中的版本号非法: ${version}`);
    }

    const candidates = await findPackage(name);
    if (candidates === null) {
        console.warn('::warning::仓库中没有 packages 目录，可能是迁移前的提交，将跳过发布');
        await writeOutput({ name, version, matched: false, reason: '仓库中没有 packages 目录，可能是迁移前的提交' });
        return;
    }
    if (candidates.length !== 1) {
        throw new Error(`包 ${name} 在 packages/*/ 下匹配到 ${candidates.length} 个目录，需恰好 1 个`);
    }

    const [{ type, dir }] = candidates;

    const bazaar = await readJson<BazaarFile>(path.join(rootDir, 'bazaar.json'));
    if (!bazaar) {
        throw new Error('bazaar.json 不存在');
    }
    if (!bazaar.owner) {
        throw new Error('bazaar.json 缺少 owner');
    }
    if (!bazaar.types?.[type]) {
        throw new Error(`bazaar.json 缺少 types.${type}`);
    }

    const meta = await readJson<PackageMeta>(path.join(rootDir, dir, 'meta.json'));
    if (!meta) {
        console.warn(`::warning::${dir} 缺少 meta.json，可能是旧版本 tag，将跳过发布`);
        await writeOutput({
            name,
            version,
            matched: false,
            reason: '包目录缺少 meta.json，可能是旧版本 tag',
            type,
            dir,
            owner: bazaar.owner,
        });
        return;
    }

    const versionMatched = meta.version === version;
    if (!versionMatched) {
        console.warn(`::warning::meta.json 的 version (${meta.version}) 与 tag (${version}) 不一致，将跳过发布`);
    }

    await writeOutput({
        name,
        version,
        meta_version: meta.version ?? '',
        matched: versionMatched,
        reason: versionMatched ? '' : `meta.json 版本 (${meta.version}) 与 tag (${version}) 不一致`,
        type,
        dir,
        owner: bazaar.owner,
    });
}

try {
    await main();
} catch (error) {
    console.error(`::error::${(error as Error).message}`);
    process.exit(1);
}
