/**
 * See API Document in [API.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.md)
 * API 文档见 [API.zh-CN.md](https://github.com/siyuan-note/siyuan/blob/master/docs/API.zh-CN.md)
 * （本仓库 docs/ 目录有快照：../docs/API.md 与 ../docs/API.zh-CN.md）
 */

import { fetchSyncPost, IWebSocketData, Lute } from 'siyuan';

async function request(url: string, data?: any) {
    const response: IWebSocketData = await fetchSyncPost(url, data);
    const res = response.code === 0 ? response.data : null;
    return res;
}

// **************************************** Noteboook ****************************************

export async function lsNotebooks(): Promise<IReslsNotebooks> {
    const url = '/api/notebook/lsNotebooks';
    return request(url, '');
}

export async function openNotebook(notebook: NotebookId) {
    const url = '/api/notebook/openNotebook';
    return request(url, { notebook: notebook });
}

export async function closeNotebook(notebook: NotebookId) {
    const url = '/api/notebook/closeNotebook';
    return request(url, { notebook: notebook });
}

export async function renameNotebook(notebook: NotebookId, name: string) {
    const url = '/api/notebook/renameNotebook';
    return request(url, { notebook: notebook, name: name });
}

export async function createNotebook(name: string): Promise<Notebook> {
    const url = '/api/notebook/createNotebook';
    return request(url, { name: name });
}

export async function removeNotebook(notebook: NotebookId) {
    const url = '/api/notebook/removeNotebook';
    return request(url, { notebook: notebook });
}

export async function getNotebookConf(notebook: NotebookId): Promise<IResGetNotebookConf> {
    const data = { notebook: notebook };
    const url = '/api/notebook/getNotebookConf';
    return request(url, data);
}

export async function setNotebookConf(notebook: NotebookId, conf: NotebookConf): Promise<NotebookConf> {
    const data = { notebook: notebook, conf: conf };
    const url = '/api/notebook/setNotebookConf';
    return request(url, data);
}

// **************************************** File Tree ****************************************
export async function createDocWithMd(notebook: NotebookId, path: string, markdown: string): Promise<DocumentId> {
    const data = {
        notebook: notebook,
        path: path,
        markdown: markdown,
    };
    const url = '/api/filetree/createDocWithMd';
    return request(url, data);
}

// 文档明确 data: null，仅表示操作结果，不返回新文档信息
export async function renameDoc(notebook: NotebookId, path: string, title: string) {
    const data = {
        doc: notebook,
        path: path,
        title: title,
    };
    const url = '/api/filetree/renameDoc';
    return request(url, data);
}

export async function removeDoc(notebook: NotebookId, path: string) {
    const data = {
        notebook: notebook,
        path: path,
    };
    const url = '/api/filetree/removeDoc';
    return request(url, data);
}

export async function moveDocs(fromPaths: string[], toNotebook: NotebookId, toPath: string) {
    const data = {
        fromPaths: fromPaths,
        toNotebook: toNotebook,
        toPath: toPath,
    };
    const url = '/api/filetree/moveDocs';
    return request(url, data);
}

export async function getHPathByPath(notebook: NotebookId, path: string): Promise<string> {
    const data = {
        notebook: notebook,
        path: path,
    };
    const url = '/api/filetree/getHPathByPath';
    return request(url, data);
}

export async function getHPathByID(id: BlockId): Promise<string> {
    const data = {
        id: id,
    };
    const url = '/api/filetree/getHPathByID';
    return request(url, data);
}

export async function getIDsByHPath(notebook: NotebookId, path: string): Promise<BlockId[]> {
    const data = {
        notebook: notebook,
        path: path,
    };
    const url = '/api/filetree/getIDsByHPath';
    return request(url, data);
}

// **************************************** Asset Files ****************************************

export async function upload(assetsDirPath: string, files: any[]): Promise<IResUpload> {
    const form = new FormData();
    form.append('assetsDirPath', assetsDirPath);
    for (const file of files) {
        form.append('file[]', file);
    }
    const url = '/api/asset/upload';
    return request(url, form);
}

// **************************************** Block ****************************************
type DataType = 'markdown' | 'dom';
export async function insertBlock(
    dataType: DataType,
    data: string,
    nextID?: BlockId,
    previousID?: BlockId,
    parentID?: BlockId,
): Promise<IResdoOperations[]> {
    const payload = {
        dataType: dataType,
        data: data,
        nextID: nextID,
        previousID: previousID,
        parentID: parentID,
    };
    const url = '/api/block/insertBlock';
    return request(url, payload);
}

export async function prependBlock(
    dataType: DataType,
    data: string,
    parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
    const payload = {
        dataType: dataType,
        data: data,
        parentID: parentID,
    };
    const url = '/api/block/prependBlock';
    return request(url, payload);
}

export async function appendBlock(
    dataType: DataType,
    data: string,
    parentID: BlockId | DocumentId,
): Promise<IResdoOperations[]> {
    const payload = {
        dataType: dataType,
        data: data,
        parentID: parentID,
    };
    const url = '/api/block/appendBlock';
    return request(url, payload);
}

export async function updateBlock(dataType: DataType, data: string, id: BlockId): Promise<IResdoOperations[]> {
    const payload = {
        dataType: dataType,
        data: data,
        id: id,
    };
    const url = '/api/block/updateBlock';
    return request(url, payload);
}

export async function deleteBlock(id: BlockId): Promise<IResdoOperations[]> {
    const data = {
        id: id,
    };
    const url = '/api/block/deleteBlock';
    return request(url, data);
}

export async function moveBlock(
    id: BlockId,
    previousID?: PreviousID,
    parentID?: ParentID,
): Promise<IResdoOperations[]> {
    const data = {
        id: id,
        previousID: previousID,
        parentID: parentID,
    };
    const url = '/api/block/moveBlock';
    return request(url, data);
}

export async function getBlockKramdown(id: BlockId): Promise<IResGetBlockKramdown> {
    const data = {
        id: id,
    };
    const url = '/api/block/getBlockKramdown';
    return request(url, data);
}

export async function getChildBlocks(id: BlockId): Promise<IResGetChildBlock[]> {
    const data = {
        id: id,
    };
    const url = '/api/block/getChildBlocks';
    return request(url, data);
}

export async function transferBlockRef(fromID: BlockId, toID: BlockId, refIDs: BlockId[]) {
    const data = {
        fromID: fromID,
        toID: toID,
        refIDs: refIDs,
    };
    const url = '/api/block/transferBlockRef';
    return request(url, data);
}

// 获取块 DOM
// ⚠ 未列入官方公开 API（文档仅承诺文档内专门章节的接口），属内核路由，无兼容性保证
export async function getDom(id: string): Promise<IResGetBlockDOM> {
    const data = { id: id };
    return request('/api/block/getBlockDOM', data);
}

// 通过事务更新块，可撤回（仅支持 DOM）
// ⚠ 官方文档明确声明 /api/transactions 为内部实现，不提供兼容性或行为稳定性保证
export async function updateBlockTransactions(nodeId: string, appId: string, original: string, updated: string) {
    const nowTime = await currentTime();
    const data = [
        {
            doOperations: [
                {
                    action: 'update',
                    id: nodeId,
                    data: updated,
                },
            ],
            undoOperations: [
                {
                    action: 'update',
                    id: nodeId,
                    data: original,
                },
            ],
        },
    ];
    return request('/api/transactions', {
        session: appId,
        app: appId,
        reqId: nowTime,
        transactions: data,
    });
}

// **************************************** Attributes ****************************************
export async function setBlockAttrs(id: BlockId, attrs: { [key: string]: string }) {
    const data = {
        id: id,
        attrs: attrs,
    };
    const url = '/api/attr/setBlockAttrs';
    return request(url, data);
}

export async function getBlockAttrs(id: BlockId): Promise<{ [key: string]: string }> {
    const data = {
        id: id,
    };
    const url = '/api/attr/getBlockAttrs';
    return request(url, data);
}

// **************************************** SQL ****************************************

export async function sql(sql: string): Promise<any[]> {
    const sqldata = {
        stmt: sql,
    };
    const url = '/api/query/sql';
    return request(url, sqldata);
}

export async function getBlockByID(blockId: string): Promise<Block> {
    const sqlScript = `select * from blocks where id ='${blockId}'`;
    const data = await sql(sqlScript);
    return data[0];
}

// 刷新数据库，提交未落库的事务
export async function refreshSQL() {
    return request('/api/sqlite/flushTransaction');
}

// **************************************** Template ****************************************

export async function render(id: DocumentId, path: string): Promise<IResGetTemplates> {
    const data = {
        id: id,
        path: path,
    };
    const url = '/api/template/render';
    return request(url, data);
}

export async function renderSprig(template: string): Promise<string> {
    const url = '/api/template/renderSprig';
    return request(url, { template: template });
}

// **************************************** File ****************************************

export async function getFile(path: string): Promise<any> {
    const data = {
        path: path,
    };
    const url = '/api/file/getFile';
    try {
        const file = await fetchSyncPost(url, data);
        return file;
    } catch (error_msg) {
        return null;
    }
}

export async function putFile(path: string, isDir: boolean, file: any) {
    const form = new FormData();
    form.append('path', path);
    form.append('isDir', isDir.toString());
    // Copyright (c) 2023, terwer.
    // https://github.com/terwer/siyuan-plugin-importer/blob/v1.4.1/src/api/kernel-api.ts
    form.append('modTime', Math.floor(Date.now() / 1000).toString());
    form.append('file', file);
    const url = '/api/file/putFile';
    return request(url, form);
}

export async function removeFile(path: string) {
    const data = {
        path: path,
    };
    const url = '/api/file/removeFile';
    return request(url, data);
}

// 文档 data 为目录条目数组
export async function readDir(path: string): Promise<IResReadDir[]> {
    const data = {
        path: path,
    };
    const url = '/api/file/readDir';
    return request(url, data);
}

// **************************************** Export ****************************************

export async function exportMdContent(id: DocumentId): Promise<IResExportMdContent> {
    const data = {
        id: id,
    };
    const url = '/api/export/exportMdContent';
    return request(url, data);
}

export async function exportResources(paths: string[], name: string): Promise<IResExportResources> {
    const data = {
        paths: paths,
        name: name,
    };
    const url = '/api/export/exportResources';
    return request(url, data);
}

// **************************************** Convert ****************************************

export type PandocArgs = string;
export async function pandoc(args: PandocArgs[]) {
    const data = {
        args: args,
    };
    const url = '/api/convert/pandoc';
    return request(url, data);
}

// **************************************** Notification ****************************************

// /api/notification/pushMsg
// {
//     "msg": "test",
//     "timeout": 7000
//   }
export async function pushMsg(msg: string, timeout: number = 7000) {
    const payload = {
        msg: msg,
        timeout: timeout,
    };
    const url = '/api/notification/pushMsg';
    return request(url, payload);
}

export async function pushErrMsg(msg: string, timeout: number = 7000) {
    const payload = {
        msg: msg,
        timeout: timeout,
    };
    const url = '/api/notification/pushErrMsg';
    return request(url, payload);
}

// **************************************** Network ****************************************
export async function forwardProxy(
    url: string,
    method: string = 'GET',
    payload: any = {},
    headers: any[] = [],
    timeout: number = 7000,
    contentType: string = 'text/html',
): Promise<IResForwardProxy> {
    const data = {
        url: url,
        method: method,
        timeout: timeout,
        contentType: contentType,
        headers: headers,
        payload: payload,
    };
    const url1 = '/api/network/forwardProxy';
    return request(url1, data);
}

// **************************************** System ****************************************

export async function bootProgress(): Promise<IResBootProgress> {
    return request('/api/system/bootProgress', {});
}

export async function version(): Promise<string> {
    return request('/api/system/version', {});
}

export async function currentTime(): Promise<number> {
    return request('/api/system/currentTime', {});
}

// **************************************** Lute ****************************************

// 思源全局注入的 Lute 编辑器实例，用于 markdown / DOM / HTML 互转（同步调用，非网络请求）
const NewLute: () => Lute = (globalThis as any).Lute.New;

// 从 DOM 转 MD
export function DOM2MD(dom: string): string {
    return NewLute().BlockDOM2Md(dom);
}

// 从 DOM 转 HTML
export function DOM2HTML(dom: string): string {
    return NewLute().BlockDOM2HTML(dom);
}

// 从 HTML 转 MD
export function HTML2MD(html: string): string {
    return NewLute().HTML2Md(html);
}

// 从 HTML 转 DOM
export function HTML2DOM(html: string): string {
    return NewLute().HTML2BlockDOM(html);
}

// 从 MD 转 DOM
export function MD2DOM(markdown: string): string {
    return NewLute().Md2BlockDOM(markdown);
}

// 从 MD 转 HTML
export function MD2HTML(markdown: string): string {
    return NewLute().BlockDOM2HTML(NewLute().Md2BlockDOM(markdown));
}
