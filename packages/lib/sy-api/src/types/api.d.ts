// api.ts 各函数返回值的 ambient 全局接口声明（沿用模板风格，不改为具名导出）。
// 本文件为模块（含 export），经 declare global 注入全局作用域；引用的基础类型
// （NotebookId / Notebook / doOperation / Block / BlockType / BlockSubType 等）在本包
// types/siyuan.d.ts 中，两份声明随 src/index.ts 的 import 进入消费方编译程序。
export {};

declare global {
    interface IResGetNotebookConf {
        box: string;
        conf: NotebookConf;
        name: string;
    }

    interface IReslsNotebooks {
        notebooks: Notebook[];
    }

    interface IResUpload {
        errFiles: string[];
        succMap: { [key: string]: string };
    }

    interface IResdoOperations {
        doOperations: doOperation[];
        undoOperations: doOperation[] | null;
    }

    interface IResGetBlockKramdown {
        id: BlockId;
        kramdown: string;
    }

    interface IResGetChildBlock {
        id: BlockId;
        type: BlockType;
        subtype?: BlockSubType;
    }

    interface IResGetBlockDOM {
        dom: string;
        id: string;
    }

    interface IResGetTemplates {
        content: string;
        path: string;
    }

    interface IResReadDir {
        isDir: boolean;
        isSymlink: boolean;
        name: string;
    }

    interface IResExportMdContent {
        hPath: string;
        content: string;
    }

    interface IResBootProgress {
        progress: number;
        details: string;
    }

    interface IResForwardProxy {
        body: string;
        contentType: string;
        elapsed: number;
        headers: { [key: string]: string };
        status: number;
        url: string;
    }

    interface IResExportResources {
        path: string;
    }
}
