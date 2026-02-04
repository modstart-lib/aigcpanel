<script setup lang="ts">
import {getCurrentInstance, onMounted} from "vue";
import {Dialog} from "./../lib/dialog";

const app = getCurrentInstance();
const doQuit = () => {
    Dialog.confirm(t("common.confirmQuit")).then(() => {
        window.$mapi.app.quit();
    });
};

onMounted(() => {
    // document.body.setAttribute('arco-theme', 'dark')
});
</script>
<template>
    <div class="window-container">
        <div class="window-header flex h-10 items-center">
            <div class="window-header-title flex-grow flex items-center">&nbsp;</div>
            <div class="p-1 leading-4">
                <div class="inline-block w-6 h-6 leading-6 cursor-pointer hover:text-red-500" @click="doQuit">
                    <i class="iconfont text-sm icon-close"></i>
                </div>
            </div>
        </div>
        <div class="window-body">
            <router-view></router-view>
        </div>
    </div>
</template>
