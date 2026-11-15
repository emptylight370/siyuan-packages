<template>
  <div class="b3-dialog--open">
    <div class="b3-dialog" style="z-index: 21">
      <div class="b3-dialog__scrim" @click="closeSetting"></div>
      <div class="b3-dialog__container" style="width: 90vw; height: 90vh; left: auto; top: auto; max-width: 1280px">
        <svg class="b3-dialog__close" @click="closeSetting">
          <use xlink:href="#iconCloseRound"></use>
        </svg>
        <div class="b3-dialog__header" onselectstart="return false;">
          <h2>{{ plugin.i18n?.settingTitle }}</h2>
        </div>
        <div class="b3-dialog__body">
          <p>{{ plugin.i18n?.viewUserGuide }}</p>
          <hr />

          <div style="overflow-y: auto">
            <!-- 忽略索引 -->
            <h3>{{ plugin.i18n?.indexignore }}</h3>
            <a :href="plugin.i18n?.ugIndexignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            <SyTextarea v-model="ignoreindex" style="resize: vertical" />
            <SyButton @click="loadIgnoreIndex">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
            <SyButton @click="saveIgnoreIndex">{{ plugin.i18n?.saveIndexignore }}</SyButton>
            <hr />

            <!-- 忽略搜索 -->
            <h3>{{ plugin.i18n?.searchignore }}</h3>
            <a :href="plugin.i18n?.ugSearchignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            <SyTextarea v-model="searchignore" style="resize: vertical" />
            <SyButton @click="loadSearchIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
            <SyButton @click="saveSearchIgnore">{{ plugin.i18n?.saveSearchignore }}</SyButton>
            <hr />

            <!-- 忽略引用 -->
            <h3>{{ plugin.i18n?.refsearchignore }}</h3>
            <a :href="plugin.i18n?.ugRefignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            <SyTextarea v-model="refsearchignore" style="resize: vertical" />
            <SyButton @click="loadRefsearchIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
            <SyButton @click="saveRefsearchIgnore">{{ plugin.i18n?.saveRefsearchignore }}</SyButton>
            <hr v-if="syncEnabled" />

            <!-- 忽略同步 -->
            <h3 v-if="syncEnabled">{{ plugin.i18n?.syncignore }}</h3>
            <a :href="plugin.i18n?.ugSyncignoreLink" @click="closeSetting" v-if="syncEnabled">{{
              plugin.i18n?.ugLink
            }}</a>
            <SyTextarea v-model="syncignore" style="resize: vertical" v-if="syncEnabled" />
            <SyButton @click="loadSyncIgnore" v-if="syncEnabled">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
            <SyButton @click="saveSyncIgnore" v-if="syncEnabled">{{ plugin.i18n?.saveSyncignore }}</SyButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getRawFile, putRawFile, pushErrMsg } from 'sy-api';
import { SyAttributeTextarea, SyButton } from 'sy-vite-component';
import { usePlugin } from '@/main';
import { onMounted, ref, type Ref } from 'vue';

const plugin = usePlugin();
const ignoreindex = ref('');
const searchignore = ref('');
const refsearchignore = ref('');
const syncignore = ref('');

const syncEnabled = ref(false);

onMounted(async () => {
  await loadIgnoreIndex();
  await loadSearchIgnore();
  await loadRefsearchIgnore();
  if (window.siyuan?.config?.sync?.enabled) {
    await loadSyncIgnore();
    syncEnabled.value = true;
  }
});

// 内核对同步类忽略文件不剥 BOM，带 BOM 时第一条规则会失效，因此读入后统一去掉、保存时不写回
const stripBom = (text: string) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const normalizeText = (text: string) => stripBom(text).replace(/\r\n?/g, '\n');

async function loadIgnoreFile(path: string, target: Ref<string>) {
  const res = await getRawFile(path);
  if (res.ok) {
    // 读取失败时绝不写入 target，避免用户把真实内容覆盖成空
    target.value = normalizeText(res.content);
  } else {
    pushErrMsg(`Load ${path} failed: ${res.message}`);
  }
}

async function saveIgnoreFile(path: string, source: Ref<string>) {
  const res = await putRawFile(path, stripBom(source.value));
  if (!res.ok) {
    pushErrMsg(`Save ${path} failed: ${res.message}`);
  }
}

function loadIgnoreIndex() {
  return loadIgnoreFile('/data/.siyuan/indexignore', ignoreindex);
}

function saveIgnoreIndex() {
  return saveIgnoreFile('/data/.siyuan/indexignore', ignoreindex);
}

function loadSearchIgnore() {
  return loadIgnoreFile('/data/.siyuan/searchignore', searchignore);
}

function saveSearchIgnore() {
  return saveIgnoreFile('/data/.siyuan/searchignore', searchignore);
}

function loadRefsearchIgnore() {
  return loadIgnoreFile('/data/.siyuan/refsearchignore', refsearchignore);
}

function saveRefsearchIgnore() {
  return saveIgnoreFile('/data/.siyuan/refsearchignore', refsearchignore);
}

function loadSyncIgnore() {
  return loadIgnoreFile('/data/.siyuan/syncignore', syncignore);
}

function saveSyncIgnore() {
  return saveIgnoreFile('/data/.siyuan/syncignore', syncignore);
}

const closeSetting = () => {
  const settingEl = document.querySelector('.ignore-setting');
  if (settingEl) {
    settingEl.remove();
  }
};
</script>

<style lang="scss" scoped></style>
