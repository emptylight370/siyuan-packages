#!/usr/bin/env node
// 校验各包产物元数据（dist/<type>.json）是否符合集市要求；在仓库根运行：node scripts/validate-meta.mjs
// 规则来源：siyuan-note/plugin-sample 的 README 与 plugin.json（0.5.2）以及集市规则（siyuan-note/bazaar rules/）
import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const problems = [];

// 集市必需字段：标识信息 + 多语言元信息（default 子字段单独校验）
const REQUIRED_FIELDS = ['name', 'author', 'url', 'version', 'minAppVersion', 'displayName', 'description', 'readme'];
const MAX_ICON_BYTES = 64 * 1024; // 集市限制 64 KiB，建议 160x160，不支持 SVG
const MAX_PREVIEW_BYTES = 512 * 1024; // 集市限制 512 KiB，建议 1024x768
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][\w.]+)?$/;

async function exists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

// semver 三段比较：a >= b 返回 true
function minVerOk(value, required) {
    const a = String(value || '0')
        .split('.')
        .map(Number);
    const b = required.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) {
        if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
        if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
    }
    return true;
}

function requireField(manifest, field, label) {
    const value = manifest[field];
    if (value === undefined || value === null || value === '') {
        problems.push(`${label}: 缺少必需字段 ${field}`);
    }
}

// 收集存在 dist 产物的包
const packages = [];
const packagesDir = path.join(root, 'packages');
for (const typeEntry of await fs.readdir(packagesDir, { withFileTypes: true })) {
    if (!typeEntry.isDirectory()) continue;
    const typePath = path.join(packagesDir, typeEntry.name);
    for (const pkgEntry of await fs.readdir(typePath, { withFileTypes: true })) {
        if (!pkgEntry.isDirectory()) continue;
        const distDir = path.join(typePath, pkgEntry.name, 'dist');
        if (await exists(distDir)) {
            packages.push({ pkgName: pkgEntry.name, pkgType: typeEntry.name, distDir });
        }
    }
}

for (const { pkgName, pkgType, distDir } of packages) {
    const label = pkgName;
    const metaFile = path.join(distDir, `${pkgType}.json`);
    if (!(await exists(metaFile))) {
        problems.push(`${label}: 缺少产物元数据 dist/${pkgType}.json（先构建）`);
        continue;
    }

    const manifest = JSON.parse(await fs.readFile(metaFile, 'utf8'));

    // 必需字段
    for (const field of REQUIRED_FIELDS) requireField(manifest, field, label);

    // 多语言字段的 default 子字段必须存在（集市以 default 兜底）
    for (const field of ['displayName', 'description', 'readme']) {
        const value = manifest[field];
        if (value && typeof value === 'object' && !value.default) {
            problems.push(`${label}: ${field}.default 缺失`);
        }
    }

    // name 必须与包目录一致（集市要求 name 与仓库名一致）
    if (manifest.name !== undefined && manifest.name !== pkgName) {
        problems.push(`${label}: name (${manifest.name}) 与目录名 (${pkgName}) 不一致`);
    }

    // version 需符合 semver
    if (manifest.version !== undefined && !SEMVER.test(manifest.version)) {
        problems.push(`${label}: version (${manifest.version}) 不符合 semver`);
    }

    // 主题特有：modes 仅允许 light/dark
    if (pkgType === 'theme' && manifest.modes) {
        const invalid = manifest.modes.filter((m) => m !== 'light' && m !== 'dark');
        if (invalid.length > 0) {
            problems.push(`${label}: modes 含非法值（仅允许 light/dark）`);
        }
    }

    // 图标与预览图：存在、体积上限、不支持 SVG
    for (const [field, maxBytes, maxSizeLabel] of [
        ['icon', MAX_ICON_BYTES, '64 KiB'],
        ['preview', MAX_PREVIEW_BYTES, '512 KiB'],
    ]) {
        const fileName = manifest[field];
        if (!fileName) continue; // 可选字段
        const filePath = path.join(distDir, fileName);
        if (!(await exists(filePath))) {
            problems.push(`${label}: ${field} 指向的 ${fileName} 不在产物中`);
            continue;
        }
        if (fileName.toLowerCase().endsWith('.svg')) {
            problems.push(`${label}: ${field} 不支持 SVG`);
        }
        const size = (await fs.stat(filePath)).size;
        if (size > maxBytes) {
            problems.push(`${label}: ${field} (${fileName}) ${(size / 1024).toFixed(1)} KiB 超过上限 ${maxSizeLabel}`);
        }
    }

    // 版本联动（settingsWindow 需 3.8.7+；publish.resources 目录声明需 3.8.6+）
    if (manifest.settingsWindow && !minVerOk(manifest.minAppVersion, '3.8.7')) {
        problems.push(`${label}: 声明 settingsWindow 需要 minAppVersion >= 3.8.7，当前 ${manifest.minAppVersion}`);
    }
    if (manifest.publish?.resources?.some((r) => r.endsWith('/')) && !minVerOk(manifest.minAppVersion, '3.8.6')) {
        problems.push(
            `${label}: publish.resources 使用目录声明需要 minAppVersion >= 3.8.6，当前 ${manifest.minAppVersion}`,
        );
    }

    console.log(`${label}: ${pkgType}.json OK（${Object.keys(manifest).length} 字段）`);
}

if (problems.length > 0) {
    console.error(`\n发现 ${problems.length} 个问题:`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
}
console.log(`\n校验通过（${packages.length} 个包）`);
