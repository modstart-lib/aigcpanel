<script setup lang="ts">
import {EnumServerStatus, ServerRecord} from "../../types/Server";
import {computed, ref, toRaw} from "vue";
import {useServerStore} from "../../store/modules/server";
import {Dialog} from "../../lib/dialog";
import {cloneDeep} from "lodash-es";
import {t} from "../../lang";

const serverStore = useServerStore()
const props = defineProps<{
    record: ServerRecord,
}>()
const visible = ref(false)
const settings = ref<any>([])
const setting = ref({})
const readonly = computed(() => {
    return ![
        EnumServerStatus.STOPPED,
        EnumServerStatus.ERROR,
    ].includes(props.record.status)
})
const gpus = ref<{
    id: string,
    name: string,
    size: number,
}[]>([])

const getGpus = async () => {
    let gpus: any = []
    gpus.push({id: '', name: '默认', size: 0})
    gpus = gpus.concat(await window.$mapi.server.listGpus())
    return gpus
}

const show = async () => {
    gpus.value = await getGpus()
    visible.value = true
    settings.value = cloneDeep(props.record.settings)
    const settingValue = {}
    settings.value.forEach((s: any) => {
        settingValue[s.name] = props.record.setting?.[s.name] || s.defaultValue || ''
    })
    setting.value = settingValue
}

const doSubmit = async () => {
    await serverStore.updateSetting(props.record.key, cloneDeep(toRaw(setting.value)))
    Dialog.tipSuccess(t('设置成功'))
    visible.value = false
}

defineExpose({
    show
})
</script>

<template>
    <a-modal v-model:visible="visible"
             width="40rem"
             title-align="start">
        <template #title>
            {{ $t('设置') }}
        </template>
        <template #footer>
            <a-button type="primary"
                      :disabled="readonly"
                      @click="doSubmit">{{ $t('确定') }}
            </a-button>
        </template>
        <div>
            <a-form :model="{}">
                <div v-for="fs in settings">
                    <a-form-item v-if="fs.type==='text'"
                                 :field="fs.name"
                                 :label="fs.title">
                        <a-input :placeholder="fs.placeholder"
                                 :readonly="readonly"
                                 v-model="setting[fs.name]"/>
                    </a-form-item>
                    <a-form-item v-else-if="fs.type==='radio'"
                                 :field="fs.name"
                                 :label="fs.title">
                        <a-radio-group v-model="setting[fs.name]"
                                       :disabled="readonly">
                            <a-radio v-for="option in fs.options"
                                     :key="option.value"
                                     :value="option.value">{{ option.label }}
                            </a-radio>
                        </a-radio-group>
                    </a-form-item>
                    <a-form-item v-else-if="fs.type==='gpuSelector'"
                                 :field="fs.name"
                                 :label="fs.title">
                        <a-input v-model="setting[fs.name]"
                                 :disabled="readonly"
                                 :placeholder="fs.placeholder"
                        >
                        </a-input>
                        <!--                        <a-select v-model="setting[fs.name]"-->
                        <!--                                  :disabled="readonly">-->
                        <!--                            <a-option v-for="gpu in gpus"-->
                        <!--                                      :key="gpu.id"-->
                        <!--                                      :value="gpu.id">-->
                        <!--                                {{ gpu.name }}({{ gpu.id }}-{{ gpu.size }})-->
                        <!--                            </a-option>-->
                        <!--                        </a-select>-->
                    </a-form-item>
                </div>
            </a-form>
        </div>
    </a-modal>
</template>
