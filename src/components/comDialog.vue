<template>
  <Teleport to="#app">
    <Transition>
      <div
        v-if="show"
        class="absolute inset-0 z-50 bg-[rgba(0,0,0,0.5)] flex items-center justify-center"
        @click.self="close"
      >
        <div
          :style="{
            width,
            height
          }"
          class="rounded-xl dialog-content max-h-80"
        >
          <div class="flex items-center justify-between p-[10px_8px]">
            <div class="text-[16px] font-500 text-white">{{ title }}</div>
            <div class="flex items-center">
              <slot name="close" />
              <div
                v-if="slotExist('close')"
                class="common-transparent cursor-pointer w-7 h-7 rounded-lg flex items-center justify-center"
                @click="clear"
              >
                <X color="white" :size="16" />
              </div>
            </div>
          </div>
          <div class="w-full h-[calc(100%-36px)]">
            <slot name="content" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { X } from '@lucide/vue'

interface ComDialogProps {
  isClose?: boolean
  title?: string
  width?: string
  height?: string
}

const show = defineModel<boolean>({ required: true })

const props = withDefaults(defineProps<ComDialogProps>(), {
  isClose: false,
  title: '',
  width: '480px',
  height: 'auto'
})

const emit = defineEmits(['close'])

const slots = useSlots()

const slotExist = (name: string): boolean => {
  return !slots[name]
}

const close = (): void => {
  if (props.isClose) return
  show.value = false
}

const clear = (): void => {
  show.value = false
  emit('close')
}
</script>

<style scoped lang="scss">
.v-enter-active,
.v-leave-active {
  transition: opacity 0.3s ease;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.dialog-content {
  background: linear-gradient(
    180deg,
    rgba(24, 23, 26, 0.96),
    rgba(12, 11, 12, 0.92)
  );
  border: 1px solid rgba(244, 210, 138, 0.16);
  border-radius: 15px;
  box-shadow:
    0 26px 90px rgba(0, 0, 0, 0.56),
    0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
</style>
