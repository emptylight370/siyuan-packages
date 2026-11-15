import { Plugin } from 'siyuan';

import './style.scss';

export default class PluginNotoSans extends Plugin {
    pluginName = 'siyuan-ttf-Noto_Sans';

    onload() {
        console.log(`${this.pluginName}: load start.`);

        // @font-face 与字体栈声明由随包的 index.css 经 loadPetals 注入（pluginsStyle 元素），
        // 不在 onload 中手动 fetch：以 snippetCSS 为前缀注入的样式会被代码片段加载逻辑移除，
        // 导致启动时样式短暂出现后被删除，只有手动重启插件才能恢复
        setTimeout(() => {
            if (!document.fonts || typeof document.fonts.load !== 'function') return;
            try {
                // 预加载字体
                document.fonts.load('16px "NotoSans Plugin"');
                document.fonts.load('16px "NotoSans SC Plugin"');
                document.fonts.load('16px "NotoSans TC Plugin"');
                document.fonts.load('16px "NotoSans JP Plugin"');
            } catch (_) {
                // 预加载失败可安全忽略：样式已注入，浏览器按 font-display: swap 兜底
            }
            console.log(`${this.pluginName}: loaded.`);
        }, 0);
    }

    onunload() {
        // 样式由前端在 destroyPlugin 中按 pluginsStyle${name} 移除，无需手动清理
        console.log(`${this.pluginName}: unloaded.`);
    }

    uninstall() {
        console.log(`${this.pluginName}: uninstall.`);
    }
}
