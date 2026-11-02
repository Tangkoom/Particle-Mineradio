<template>
  <ComDialog v-model="isShow" width="700px" height="500px" :title="t('设置')">
    <template #content>
      <div class="w-full h-full flex">
        <div
          class="w-[188px] h-full box-border p-[0_12px] flex-shrink-0 relative"
        >
          <div
            :style="{
              height: activeMap.height,
              width: activeMap.width,
              top: activeMap.currentMenuTop
            }"
            class="bg-[#43454a] rounded-[12px] absolute transform transition-all duration-200"
          ></div>
          <div ref="menuListWrapperRef" class="relative">
            <div
              v-for="(item, index) in menuList"
              :key="item.value"
              class="text-[#f9fafb] text-[14px] text-left p-[9px_16px_9px_12px] cursor-pointer"
              @click="(e) => activeMenu(e, index)"
            >
              {{ t(item.label) }}
            </div>
          </div>
        </div>
        <div class="w-[calc(100%-188px)] h-full">
          <GeneralSetting v-if="activeMap.currentMenu === 0" />
        </div>
      </div>
    </template>
  </ComDialog>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import GeneralSetting from './general-setting.vue'

const { t } = useI18n({ useScope: 'global' })

const isShow = ref<boolean>(false)
const menuListWrapperRef = useTemplateRef<HTMLDivElement>('menuListWrapperRef')

const activeMap = ref<Record<string, string | number>>({
  height: '0px',
  width: '0px',
  currentMenu: 0,
  currentMenuTop: '0px'
})

const menuList = reactive<Record<string, any>[]>([
  { label: '通用设置', value: '1' },
  { label: '账号设置', value: '2' }
])

const activeMenu = (e: MouseEvent, idx: number): void => {
  const target = e.currentTarget as HTMLElement
  activeMap.value = {
    height: `${target.clientHeight}px`,
    width: `${target.clientWidth}px`,
    currentMenu: idx,
    currentMenuTop: `${target.offsetTop}px`
  }
}

const defaultActiveMap = (): void => {
  const first = menuListWrapperRef.value
    ?.firstElementChild as HTMLElement | null
  if (!first) return
  activeMap.value = {
    height: `${first.clientHeight}px`,
    width: `${first.clientWidth}px`,
    currentMenu: 0,
    currentMenuTop: `${first.offsetTop}px`
  }
}

const openDialog = (): void => {
  isShow.value = true
  nextTick(() => {
    defaultActiveMap()
  })
}

defineExpose({ openDialog })
</script>

<style scoped lang="scss"></style>
