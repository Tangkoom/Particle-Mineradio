<template>
  <DialogRoot>
    <slot name="trigger" />
    <DialogPortal>
      <DialogOverlay
        class="dialog-overlay data-[state=open]:animate-overlayShow fixed inset-0 z-30 rounded-[15px]"
      />
      <DialogContent
        :style="{ width: props.width }"
        class="dialog-content fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-100"
      >
        <DialogTitle as-child>
          <VisuallyHidden>对话框</VisuallyHidden>
        </DialogTitle>
        <DialogDescription as-child>
          <VisuallyHidden>对话框内容</VisuallyHidden>
        </DialogDescription>
        <div class="w-full flex justify-end">
          <slot v-if="props.customClose" name="close" />
          <DialogClose
            v-else
            aria-label="Close"
            id="common-transparent"
            class="ml-2.75 cursor-pointer commmon-shadow hover:bg-red-500 w-7 h-7 rounded-lg flex items-center justify-center"
          >
            <X color="white" :size="16" />
          </DialogClose>
        </div>
        <div class="w-full h-[calc(100%-28px)]">
          <slot name="content" />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script lang="ts" setup>
import { X } from '@lucide/vue'

interface DialogProps {
  customClose?: boolean
  width?: string
}

const props = withDefaults(defineProps<DialogProps>(), {
  customClose: false,
  width: '480px'
})
</script>

<style scoped lang="scss">
.dialog-overlay {
  background:
    radial-gradient(
      circle at 50% 48%,
      rgba(244, 210, 138, 0.07),
      transparent 34%
    ),
    rgba(0, 0, 0, 0.78);
}

.dialog-content {
  background: linear-gradient(
    180deg,
    rgba(24, 23, 26, 0.96),
    rgba(12, 11, 12, 0.92)
  );
  border: 1px solid rgba(244, 210, 138, 0.16);
  border-radius: 15px;
  padding: 14px;
  box-sizing: border-box;
  text-align: center;
  box-shadow:
    0 26px 90px rgba(0, 0, 0, 0.56),
    0 0 0 1px rgba(255, 255, 255, 0.035),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  will-change: opacity, transform, filter;
}
</style>
