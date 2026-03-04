<script setup>
import { useI18n } from 'vue-i18n';

const props = defineProps({ item: Object, index: Number });
const { t } = useI18n();

const getLabel = (item) => {
    if (item?.i18nKey) return t(item.i18nKey);
    return item?.header || '';
};
</script>

<template>
    <v-list-subheader color="darkText" class="smallCap text-uppercase text-subtitle-2 font-weight-bold"
        :class="index > 0 ? 'mt-0' : ''">{{ getLabel(props.item) }}</v-list-subheader>
</template>
