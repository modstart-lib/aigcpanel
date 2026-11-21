<script setup lang="ts">
import { nextTick, ref, watch } from "vue";

const props = defineProps<{
    value: string | null | undefined;
    onChangeCallback?: (value: string) => Promise<boolean>;
    /** 禁用时仅展示内容，点击不再弹出编辑框 */
    disabled?: boolean;
}>();
const emit = defineEmits({
    change: (value: string) => true,
});
const visible = ref(false);
const valueEdit = ref("");
const onVisibleChange = (val: boolean) => {
    if (props.disabled) {
        visible.value = false;
        return;
    }
    visible.value = val;
    if (val) {
        valueEdit.value = props.value as string;
    }
};
// 变为禁用时立即关闭已弹出的编辑框
watch(
    () => props.disabled,
    (val) => {
        if (val) {
            visible.value = false;
        }
    },
);
const doEnter = () => {
    nextTick(() => {
        doConfirm();
    });
};
const doConfirm = () => {
    if (props.onChangeCallback) {
        props.onChangeCallback(valueEdit.value).then((ok) => {
            if (ok) {
                visible.value = false;
                emit("change", valueEdit.value);
            }
        });
    } else {
        emit("change", valueEdit.value);
        nextTick(() => {
            visible.value = false;
        });
    }
};
</script>

<template>
    <div>
        <a-popover
            :popup-visible="props.disabled ? false : visible"
            trigger="click"
            @popup-visible-change="onVisibleChange"
        >
            <slot></slot>
            <template #content>
                <div class="flex">
                    <a-input v-model="valueEdit" @pressEnter="doEnter">
                        <template #append>
                            <div class="cursor-pointer" @click="doConfirm">
                                <icon-check />
                            </div>
                        </template>
                    </a-input>
                </div>
            </template>
        </a-popover>
    </div>
</template>
