import type { Component } from 'vue';
import { createApp } from 'vue';

export function getDomByVueComponent(component: Component) {
    const div = document.createElement('div');
    const app = createApp(component);
    app.mount(div);
    return div;
}
