// 仓库结构校验：不构建、不产生物，只检查各发布包的静态契约。
// 供 `pnpm check` 与 lefthook pre-commit 调用；与构建期校验的分工：
// - 这里管「包的形状」：清单字段、资源文件、命名约定（所有发布包全量查）；
// - build-plugin.mjs 管「本次构建」：TAG_VERSION 一致性、输出目录资源。
// 检测项刻意精简：复用 resolvePluginMeta 覆盖清单与资源，额外只补四项纯静态规则。
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { resolvePluginMeta } from './plugin-meta.mjs';

const rootDir = path.resolve(import.meta.dirname, '..');
const packagesDir = path.join(rootDir, 'packages');

async function readJson(file) {
    try {
        return JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {
        return null;
    }
}

async function fileExists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

// 集市规范：version 单调递增且不带 v 前缀
function checkVersionFormat(version) {
    if (typeof version !== 'string' || /^v/.test(version)) {
        return 'version 不应带 v 前缀';
    }
    if (!/^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(version)) {
        return `version 不是规范的 semver: ${version}`;
    }
    return null;
}

// 集市描述字段约定：displayName / description 至少提供 default 文案
function checkLocalizedField(meta, field) {
    const value = meta[field];
    if (typeof value === 'string' || (value && typeof value.default === 'string')) {
        return null;
    }
    return `缺少 ${field}.default 文案`;
}

// bazaar 默认值 + 包级覆盖合并后的平台范围不能为空数组
function checkPlatformRange(meta, field) {
    if (Array.isArray(meta[field]) && meta[field].length > 0) {
        return null;
    }
    return `${field} 不能为空数组`;
}

// 官方示例约定（siyuan-note/plugin-sample README.zh-CN.md）的特性版本门槛：
// - publish.resources 目录形式（以 / 结尾）要求思源 3.8.6+；文件形式无版本要求
// - settingsWindow: true（桌面端独立设置窗口）要求思源 3.8.7+
// 其他已知但未检查的门槛见根 AGENTS.md「特性版本门槛」记录。
const DIRECTORY_RESOURCES_MIN_APP_VERSION = '3.8.6';
const SETTINGS_WINDOW_MIN_APP_VERSION = '3.8.7';

function compareVersions(a, b) {
    const parse = (version) => version.split('-')[0].split('.').map(Number);
    const [aMajor, aMinor, aPatch] = parse(a);
    const [bMajor, bMinor, bPatch] = parse(b);
    for (let i = 0; i < 3; i += 1) {
        const left = [aMajor, aMinor, aPatch][i] ?? 0;
        const right = [bMajor, bMinor, bPatch][i] ?? 0;
        if (left !== right) {
            return left - right;
        }
    }
    return 0;
}

// 特性用到宿主新版本能力时的通用检查：minAppVersion 必须声明且达到门槛
function requireMinAppVersion(feature, minVersion, meta) {
    if (!meta.minAppVersion) {
        return `${feature} 要求思源 ${minVersion}+，但未填写 minAppVersion`;
    }
    if (compareVersions(meta.minAppVersion, minVersion) < 0) {
        return `${feature} 要求 minAppVersion >= ${minVersion}，当前为 ${meta.minAppVersion}`;
    }
    return null;
}

function checkPublishResources(meta) {
    const resources = meta.publish?.resources ?? [];
    if (!resources.some((resource) => typeof resource === 'string' && resource.endsWith('/'))) {
        return null;
    }
    return requireMinAppVersion('publish.resources 目录形式', DIRECTORY_RESOURCES_MIN_APP_VERSION, meta);
}

function checkSettingsWindow(meta) {
    if (meta.settingsWindow !== true) {
        return null;
    }
    return requireMinAppVersion('settingsWindow', SETTINGS_WINDOW_MIN_APP_VERSION, meta);
}

async function checkPackage(pkgDir) {
    const pkgName = path.basename(pkgDir);
    const errors = [];
    const warnings = [];

    // 覆盖：目录层级、bazaar owner/types、meta.json 禁止 name/url、
    // version 存在、合并后必填字段、readme/icon/preview/publish.resources 存在
    let meta;
    try {
        ({ meta } = await resolvePluginMeta({ pkgDir }));
    } catch (error) {
        return [pkgName, [error.message], []];
    }

    // minAppVersion 集市非必填（缺省视为全版本适用），仅推荐填写
    if (!meta.minAppVersion) {
        warnings.push('未填写 minAppVersion（非必填，缺省视为全版本适用，推荐填写以标明最低兼容版本）');
    }

    const pkgJson = await readJson(path.join(pkgDir, 'package.json'));
    if (!pkgJson) {
        errors.push('package.json 缺失或不是合法 JSON');
    } else if (pkgJson.name !== pkgName) {
        // 目录名同时是插件名、产物 name 与发布仓库名，不允许分叉
        errors.push(`package.json name (${pkgJson.name}) 与目录名 (${pkgName}) 不一致`);
    }

    for (const message of [
        checkVersionFormat(meta.version),
        checkLocalizedField(meta, 'displayName'),
        checkLocalizedField(meta, 'description'),
        checkPlatformRange(meta, 'backends'),
        checkPlatformRange(meta, 'frontends'),
        checkPublishResources(meta),
        checkSettingsWindow(meta),
    ]) {
        if (message) errors.push(message);
    }

    return [pkgName, errors, warnings];
}

async function main() {
    const pkgDirs = [];
    const types = await fs.readdir(packagesDir, { withFileTypes: true });
    for (const type of types.filter((entry) => entry.isDirectory())) {
        const pkgs = await fs.readdir(path.join(packagesDir, type.name), { withFileTypes: true });
        for (const pkg of pkgs.filter((entry) => entry.isDirectory())) {
            const pkgDir = path.join(packagesDir, type.name, pkg.name);
            // 无 meta.json 的目录（如 lib）不发布集市，跳过
            if (await fileExists(path.join(pkgDir, 'meta.json'))) {
                pkgDirs.push(pkgDir);
            }
        }
    }

    const results = await Promise.all(pkgDirs.map(checkPackage));
    let failed = 0;
    for (const [pkgName, errors, warnings] of results) {
        if (errors.length === 0 && warnings.length === 0) {
            console.log(`  ok  ${pkgName}`);
            continue;
        }
        if (errors.length > 0) {
            failed += 1;
            console.error(`  fail  ${pkgName}`);
            for (const message of errors) {
                console.error(`    - ${message}`);
            }
        } else {
            console.log(`  warn  ${pkgName}`);
        }
        for (const message of warnings) {
            console.warn(`    ~ ${message}`);
        }
    }

    if (failed > 0) {
        console.error(`\ncheck: ${failed}/${results.length} 个包未通过`);
        process.exit(1);
    }
    console.log(`\ncheck: ${results.length} 个包全部通过`);
}

main();
