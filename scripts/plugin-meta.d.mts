export interface PluginMeta {
  name: string;
  url: string;
  version: string;
  author: string;
  minAppVersion: string;
  backends: string[];
  frontends: string[];
  displayName: Record<string, string>;
  description: Record<string, string>;
  readme: Record<string, string>;
  icon: string;
  preview: string;
  disabledInPublish?: boolean;
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

export function findRootDir(start: string): Promise<string>;

export function resolvePluginMeta(options: ResolvePluginMetaOptions): Promise<ResolvedPluginMeta>;
