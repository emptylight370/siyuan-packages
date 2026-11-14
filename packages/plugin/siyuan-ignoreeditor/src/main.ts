import { Plugin } from 'siyuan';
import { createApp } from 'vue';
import type { App as VueApp } from 'vue';
import App from './App.vue';

let plugin: Plugin | null = null;
export function usePlugin(pluginProps?: Plugin): Plugin {
    // console.log('usePlugin', pluginProps, plugin);
    if (pluginProps) {
        plugin = pluginProps;
    }
    if (!plugin && !pluginProps) {
        console.error('need bind plugin');
    }
    return plugin!;
}

let app: VueApp<Element> | null = null;
export function init(plugin: Plugin) {
    // bind plugin hook
    usePlugin(plugin);

    const div = document.createElement('div');
    div.id = usePlugin().name;
    const instance = createApp(App);
    instance.mount(div);
    app = instance;
    document.body.appendChild(div);
}

export function destroy() {
    app?.unmount();
    const div = document.getElementById(usePlugin().name);
    if (div) document.body.removeChild(div);
}
