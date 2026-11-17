import { Plugin, showMessage, Menu } from 'siyuan';
import './index.scss';
import { IOperation, IProtyle } from 'siyuan/types';

export default class FormatHelper extends Plugin {
    // 存储固定引用：bind 每次会生成新函数，off 必须传入与 on 相同的引用才能移除监听器
    private readonly onBlockIcon = this.addTextBlockItem.bind(this);
    // 防止重复点击：上一次批量处理未结束时忽略新的触发
    private processing = false;

    // 加载完成
    onload() {
        this.eventBus.on('click-blockicon', this.onBlockIcon);
        console.log(this.i18n.helloPlugin);
    }

    // 界面显示完成
    onLayoutReady() {
        // console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
    }

    // 插件取消加载
    onunload() {
        this.eventBus.off('click-blockicon', this.onBlockIcon);
        console.log(this.i18n.byePlugin);
    }

    // 插件卸载或停用
    uninstall() {
        this.eventBus.off('click-blockicon', this.onBlockIcon);
        console.log(this.i18n.uninstallPlugin);
    }

    // SECTION 添加点击菜单====================>
    // NOTE - 添加内容块菜单
    private addTextBlockItem({ detail }: any) {
        const menu: Menu = detail.menu;
        const submenu = [];
        const blockElements: HTMLElement[] = detail.blockElements;
        const protyle = detail.protyle as IProtyle;
        const children = detail.blockElements[0].childNodes;
        // 判断选中块类型，目前只能快速分辨代码块
        if (Array.from(children).some((child) => (child as HTMLElement).classList.contains('hljs'))) {
            submenu.push({
                id: 'syFormatHelper_codeBlockIndent',
                icon: 'iconInfo',
                label: this.i18n.codeBlockAdjIndex,
                click: () => {
                    showMessage(this.i18n.codeBlockOnlyFirst);
                    this.handleCodeBlock(detail, 'indent');
                },
            });
            submenu.push({
                id: 'syFormatHelper_codeBlockRindent',
                icon: 'iconInfo',
                label: this.i18n.codeBlockRmIndex,
                click: () => {
                    showMessage(this.i18n.codeBlockOnlyFirst);
                    this.handleCodeBlock(detail, 'rindent');
                },
            });
        } else {
            // 文本块操作菜单：数据驱动，统一入口为 processTextBlocks
            const textItems: Array<{ label: string; type: string }> = [
                { label: this.i18n.textBlockRmWhiteSpace, type: 'remove' },
                { label: this.i18n.textBlockAddSpace, type: 'space' },
                { label: this.i18n.textBlockUpperCase, type: 'upper' },
                { label: this.i18n.textBlockLowerCase, type: 'lower' },
                { label: this.i18n.textBlockFullToHalf, type: 'fullToHalf' },
                { label: this.i18n.textBlockHalfToFull, type: 'halfToFull' },
                { label: this.i18n.lawAddSpace, type: 'law' },
                { label: this.i18n.CNtoEN, type: 'CNtoEN' },
                { label: this.i18n.ENtoCN, type: 'ENtoCN' },
            ];
            textItems.forEach((item) => {
                submenu.push({
                    id: `syFormatHelper_text_${item.type}`,
                    icon: 'iconEdit',
                    label: item.label,
                    click: () => this.processTextBlocks(blockElements, protyle, item.type),
                });
            });
        }
        if (submenu.length != 0) {
            menu.addItem({
                id: 'syFormatHelper_menu',
                icon: 'iconFormat',
                label: this.i18n.title,
                type: 'submenu',
                submenu: submenu,
            });
        }
    }
    // !SECTION 添加点击菜单====================<

    // SECTION 处理文本操作====================>
    // NOTE - 批量处理选中文本块：直接改写编辑器 DOM，单次 transaction 提交（官方 plugin-sample 模式）
    private processTextBlocks(blockElements: HTMLElement[], protyle: IProtyle, type: string) {
        if (this.processing) {
            return;
        }
        this.processing = true;
        try {
            const doOperations: IOperation[] = [];
            blockElements.forEach((blockElement) => {
                const blockId = blockElement.getAttribute('data-node-id');
                if (!blockId) {
                    return;
                }
                if (!this.applyTextTransform(blockElement, type)) {
                    return;
                }
                doOperations.push({
                    id: blockId,
                    data: blockElement.outerHTML,
                    action: 'update',
                });
            });
            if (doOperations.length === 0) {
                showMessage(this.i18n.nothingChange);
                return;
            }
            // 单次事务提交全部选中块：一次 undo 即可整体回滚
            protyle.getInstance().transaction(doOperations);
            if (type === 'law') {
                showMessage(this.i18n.lawIncludeFullSpace);
            }
        } finally {
            this.processing = false;
        }
    }

    // NOTE - 各文本变换规则：对块内每个文本节点应用一次映射
    private readonly textMappers: Record<string, (text: string) => string> = {
        // 智能移除空格（保留换行符）
        remove: (text) =>
            text
                .replace(/(?<![a-zA-Z0-9])[ \t\f\v]+(?![a-zA-Z0-9])/g, '')
                .replace(/[ ]{2,}/g, ' ')
                .trim(),
        // 为数字和英文添加空格
        space: (text) =>
            text
                .replace(/([^0-9a-zA-Z \t\f\v])([0-9a-zA-Z]+)/g, '$1 $2')
                .replace(/([0-9a-zA-Z]+)([^0-9a-zA-Z \t\f\v])/g, '$1 $2')
                .trim(),
        // 全字母大写
        upper: (text) => text.toUpperCase(),
        // 全字母小写
        lower: (text) => text.toLowerCase(),
        // 全角字符转半角字符
        fullToHalf: (text) =>
            text
                .replace(/[\uff01-\uff5e]/g, (match) => String.fromCharCode(match.charCodeAt(0) - 0xfee0))
                .replace(/\u3000/g, ' '),
        // 半角字符转全角字符
        halfToFull: (text) =>
            text
                .replace(/[\u0021-\u007e]/g, (match) => String.fromCharCode(match.charCodeAt(0) + 0xfee0))
                .replace(/ /g, '\u3000'),
        // 法律法规（章、节、条）后添加空格
        law: (text) =>
            text
                .replace(/\u3000/g, ' ')
                .replace(/(第.*?[编章节条])(?!\s)/g, '$1 ')
                .trim(),
        // 英文符号转中文符号
        ENtoCN: (text) =>
            text
                .replace(/,/g, '，')
                .replace(/\./g, '。')
                .replace(/\(/g, '（')
                .replace(/\)/g, '）')
                .replace(/\[/g, '【')
                .replace(/\]/g, '】')
                .replace(/:/g, '：')
                .replace(/;/g, '；')
                .replace(/!/g, '！')
                .replace(/\?/g, '？'),
        // 中文符号转英文符号
        CNtoEN: (text) =>
            text
                .replace(/，/g, ',')
                .replace(/。/g, '.')
                .replace(/（/g, '(')
                .replace(/）/g, ')')
                .replace(/【/g, '[')
                .replace(/】/g, ']')
                .replace(/：/g, ':')
                .replace(/；/g, ';')
                .replace(/！/g, '!')
                .replace(/？/g, '?'),
    };

    // 不参与文本变换的行内元素：行内代码/公式/备注/按键/引用等属于代码或派生内容
    private readonly skippedInlineTypes = new Set([
        'tag',
        'inline-code',
        'inline-math',
        'inline-memo',
        'kbd',
        'block-ref',
        'file-annotation-ref',
    ]);

    // 判断文本节点是否位于应跳过的行内元素内（data-type 为空格分隔的多值）
    private isInSkippedInline(root: Element, node: Node): boolean {
        let current = node.parentNode;
        while (current && current !== root && current.nodeType === Node.ELEMENT_NODE) {
            const dataType = (current as HTMLElement).getAttribute?.('data-type') || '';
            if (dataType.split(' ').some((item) => this.skippedInlineTypes.has(item))) {
                return true;
            }
            current = current.parentNode;
        }
        return false;
    }

    // NOTE - 对编辑器中的块元素应用文本变换，返回是否实际发生修改
    private applyTextTransform(blockElement: HTMLElement, type: string): boolean {
        const mapper = this.textMappers[type];
        if (!mapper) {
            return false;
        }
        // querySelectorAll 不含元素自身：块根自身即带 data-node-id，需先纳入；
        // 嵌套子块（引用块/超级块等）一并处理
        const innerBlocks: Element[] = blockElement.matches('[data-node-id]')
            ? [blockElement, ...Array.from(blockElement.querySelectorAll('[data-node-id]'))]
            : Array.from(blockElement.querySelectorAll('[data-node-id]'));
        if (innerBlocks.length === 0) {
            return false;
        }
        let changed = false;
        innerBlocks.forEach((block) => {
            const editable = block.querySelector('div[contenteditable=true]');
            if (!editable) {
                return;
            }
            const walker = document.createTreeWalker(editable, NodeFilter.SHOW_TEXT, null);
            let node;
            while ((node = walker.nextNode())) {
                const innerText = node.nodeValue;
                // 跳过行内代码、行内公式等不应被改写的行内元素
                if (!innerText || this.isInSkippedInline(editable, node)) {
                    continue;
                }
                const mapped = mapper(innerText);
                if (mapped !== innerText) {
                    node.nodeValue = mapped;
                    changed = true;
                }
            }
        });
        return changed;
    }
    // !SECTION 处理文本操作====================<

    // SECTION 处理代码块操作====================>
    // NOTE - 代码块操作：实现已迁移到 eventBus detail（与文本块一致），但功能保持抑制——
    // 改写结果被丢弃、不提交事务，点击仅提示无变化。恢复产品决策后，将改写后的
    // doc.body.firstElementChild.outerHTML 以 transaction 提交即可（见 processTextBlocks）
    private handleCodeBlock(detail: any, type: string) {
        const blockElement = detail.blockElements[0] as HTMLElement | undefined;
        if (!blockElement) {
            showMessage(this.i18n.nothingChange);
            return;
        }
        // 在块的副本上改写，不动编辑器真实 DOM（抑制状态下不能造成未提交的 DOM 变更）
        const doc = new DOMParser().parseFromString(blockElement.outerHTML, 'text/html');
        if (type === 'indent') {
            this.codeBlockDecline(doc);
            this.codeBlockRise(doc);
        } else {
            this.codeBlockDecline(doc);
        }
        // 保持抑制：不提交事务
        showMessage(this.i18n.nothingChange);
    }

    // NOTE - 移除代码块缩进
    private codeBlockDecline(doc: Document) {
        const hljs = doc.querySelector('div.hljs');
        if (!hljs) return;
        const editable = hljs.querySelector('[contenteditable=true]');
        if (!editable) return;
        editable.innerHTML = editable.innerHTML.replace(/^[ \t]+/gm, '');
    }

    // NOTE - 添加代码块缩进
    private codeBlockRise(doc: Document) {
        const hljs = doc.querySelector('div.hljs');
        if (!hljs) return;
        const editable = hljs.querySelector('[contenteditable=true]');
        if (!editable) return;
        // 缩进逻辑待实现
    }
    // !SECTION 处理代码块操作====================<
}
