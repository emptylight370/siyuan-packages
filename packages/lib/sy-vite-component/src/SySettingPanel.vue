<template>
  <div class="b3-dialog--open">
    <div class="b3-dialog" style="z-index: 16">
      <div class="b3-dialog__scrim"></div>
      <div class="b3-dialog__container">
        <div class="b3-dialog__body">
          <div class="fn__flex fn__flex-1 config__panel" style="overflow: hidden; position: relative">
            <slot>Setting Panel</slot>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
