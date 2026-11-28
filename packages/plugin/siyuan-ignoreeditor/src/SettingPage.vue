<template>
  <SySettingPanel v-model:show="show" :z-index="21" @close="closeSetting">
    <template #header>
      <h2>{{ plugin.i18n?.settingTitle }}</h2>
    </template>

    <template #default>
      <div class="fn__flex-column" style="width: 100%">
        <p>{{ plugin.i18n?.viewUserGuide }}</p>
        <hr />

        <div class="fn__flex-1" style="overflow-y: auto">
          <!-- 忽略索引 -->
          <SyTextarea v-model="ignoreindex" :rows="6" :label="plugin.i18n?.indexignore">
            <template #desc>
              <a :href="plugin.i18n?.ugIndexignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            </template>
          </SyTextarea>
          <p>{{ plugin.i18n?.indexIgnoreDesc }}</p>
          <br />
          <SyButton @click="loadIgnoreIndex">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
          <SySpace />
          <SyButton @click="saveIgnoreIndex">{{ plugin.i18n?.saveIndexignore }}</SyButton>
          <hr />

          <!-- 忽略搜索 -->
          <SyTextarea v-model="searchignore" :rows="6">
            <template #label>
              <span>{{ plugin.i18n?.searchignore }}</span>
              <a :href="plugin.i18n?.ugSearchignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            </template>
          </SyTextarea>
          <p>{{ plugin.i18n?.searchIgnoreDesc }}</p>
          <br />
          <SyButton @click="loadSearchIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
          <SySpace />
          <SyButton @click="saveSearchIgnore">{{ plugin.i18n?.saveSearchignore }}</SyButton>
          <hr />

          <!-- 忽略引用 -->
          <SyTextarea v-model="refsearchignore" :rows="6">
            <template #label>
              <span>{{ plugin.i18n?.refsearchignore }}</span>
              <a :href="plugin.i18n?.ugRefignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            </template>
          </SyTextarea>
          <p>{{ plugin.i18n?.refsearchIgnoreDesc }}</p>
          <br />
          <SyButton @click="loadRefsearchIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
          <SySpace />
          <SyButton @click="saveRefsearchIgnore">{{ plugin.i18n?.saveRefsearchignore }}</SyButton>
          <hr v-if="syncEnabled" />

          <!-- 忽略同步 -->
          <SyTextarea v-if="syncEnabled" v-model="syncignore" :rows="6">
            <template #label>
              <span>{{ plugin.i18n?.syncignore }}</span>
              <a :href="plugin.i18n?.ugSyncignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            </template>
          </SyTextarea>
          <p v-if="syncEnabled">{{ plugin.i18n?.syncIgnoreDesc }}</p>
          <br v-if="syncEnabled" />
          <SyButton v-if="syncEnabled" @click="loadSyncIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
          <SySpace />
          <SyButton v-if="syncEnabled" @click="saveSyncIgnore">{{ plugin.i18n?.saveSyncignore }}</SyButton>
          <hr />

          <!-- 忽略嵌入 -->
          <SyTextarea v-model="embeddingignore" :rows="6">
            <template #label>
              <span>{{ plugin.i18n?.embeddingignore }}</span>
              <a :href="plugin.i18n?.ugEmbeddingignoreLink" @click="closeSetting">{{ plugin.i18n?.ugLink }}</a>
            </template>
          </SyTextarea>
          <p>{{ plugin.i18n?.embeddingIgnoreDesc }}</p>
          <p v-if="embeddingVersionWarning" class="ignore-version-warning">
            {{ plugin.i18n?.embeddingIgnoreVersionWarning.replace('{version}', siyuanVersion) }}
          </p>
          <br />
          <SyButton @click="loadEmbeddingIgnore">{{ plugin.i18n?.reloadIgnoreFile }}</SyButton>
          <SySpace />
          <SyButton @click="saveEmbeddingIgnore">{{ plugin.i18n?.saveEmbeddingignore }}</SyButton>
        </div>
      </div>
    </template>
  </SySettingPanel>
</template>

<script setup lang="ts">
import { getRawFile, putRawFile, pushErrMsg, version } from 'sy-api';
import { SyButton, SySettingPanel, SySpace, SyTextarea } from 'sy-vite-component';
import semver from 'semver';
import { usePlugin } from '@/main';
import { onMounted, ref, type Ref } from 'vue';

const plugin = usePlugin();
const ignoreindex = ref('');
const searchignore = ref('');
const refsearchignore = ref('');
const syncignore = ref('');
const embeddingignore = ref('');

const syncEnabled = ref(false);

// embeddingignore 需要 3.7.0 及以上内核才生效
const MIN_EMBEDDING_VERSION = '3.7.0';
const siyuanVersion = ref('');
const embeddingVersionWarning = ref(false);

const show = ref(true);

onMounted(async () => {
  try {
    siyuanVersion.value = await version();
    const coerced = semver.coerce(siyuanVersion.value);
    embeddingVersionWarning.value = !!coerced && semver.lt(coerced, MIN_EMBEDDING_VERSION);
  } catch {
    // 版本获取失败时不显示警告
  }

  await loadIgnoreIndex();
  await loadSearchIgnore();
  await loadRefsearchIgnore();
  if (window.siyuan?.config?.sync?.enabled) {
    await loadSyncIgnore();
    syncEnabled.value = true;
  }
  await loadEmbeddingIgnore();
});

const emit = defineEmits<{ close: [] }>();

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

function loadEmbeddingIgnore() {
  return loadIgnoreFile('/data/.siyuan/embeddingignore', embeddingignore);
}

function saveEmbeddingIgnore() {
  return saveIgnoreFile('/data/.siyuan/embeddingignore', embeddingignore);
}

const closeSetting = () => {
  show.value = false;
  emit('close');
};
</script>

<style lang="scss" scoped>
.ignore-version-warning {
  color: var(--b3-callout-warning);
}
</style>
