// 思源基础全局类型（DocumentId / BlockId / Notebook / Block / SyFrontendTypes 等）
// 已抽取至 packages/lib/sy-api/src/types/siyuan.d.ts，经下方导入进入本包编译程序；
// 本文件仅保留本插件自己的 Window 扩展（declare global 合并进全局作用域）。
// 复制模板后把 pluginTemplate 键改为新包的暴露对象名。
import type {} from 'sy-api';

export {};

declare global {
    interface Window {
        siyuan: {
            notebooks: any;
            menus: any;
            dialogs: any;
            blockPanels: any;
            storage: any;
            user: any;
            ws: any;
            languages: any;
        };
        pluginTemplate: {
            [key: string]: any;
        };
    }
}
