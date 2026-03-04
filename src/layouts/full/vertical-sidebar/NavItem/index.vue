<script setup>
import Icon from '../Icon.vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({ item: Object, level: Number });
const { t } = useI18n();

const normalizedTo = (value) => {
    if (typeof value !== 'string') return value;
    return value.trim();
};

const getLabel = (item) => {
    if (item?.i18nKey) return t(item.i18nKey);
    return item?.title || '';
};
</script>

<template>
    <!---Single Item-->
    <v-list-item
        :href="item.external ? normalizedTo(item.to) : undefined"
        :to="!item.external ? normalizedTo(item.to) : undefined"
        rounded
        class="mb-1"
        color="primary"
        :disabled="item.disabled"
        :target="item.external === true ? '_blank' : undefined"
    >
        <!---If icon-->
        <template v-slot:prepend>
            <Icon :item="item.icon" :level="level" />
        </template>
        <v-list-item-title
            >{{ getLabel(item) }}
            <span v-if="item.children">
                <span v-if="item.chip" class="ps-3">
                    <v-chip
                        :color="item.chipColor"
                        :class="'sidebarchip hide-menu bg-' + item.chipBgColor"
                        :size="item.chipIcon ? 'x-small' : 'x-small'"
                        :variant="item.chipVariant"
                        :prepend-icon="item.chipIcon"
                    >
                        {{ item.chip }}
                    </v-chip>
                </span>
            </span>
        </v-list-item-title>

        <!---If Caption-->
        <v-list-item-subtitle v-if="item.subCaption" class="text-caption mt-n1 hide-menu">
            {{ item.subCaption }}
        </v-list-item-subtitle>
        <!---If any chip or label-->
        <template v-slot:append v-if="item.chip">
            <v-chip
                :color="item.chipColor"
                :class="'sidebarchip hide-menu bg-' + item.chipBgColor"
                :size="item.chipIcon ? 'x-small' : 'x-small'"
                :variant="item.chipVariant"
                :prepend-icon="item.chipIcon"
            >
                {{ item.chip }}
            </v-chip>
        </template>
    </v-list-item>
</template>
