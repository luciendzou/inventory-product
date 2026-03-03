<script setup lang="ts">
import { RouterView } from 'vue-router';
import { onMounted, onUnmounted, ref } from 'vue';
import MainView from './Main.vue';

const locale = ref(localStorage.getItem('appLocale') || 'fr');

const syncLocale = () => {
    locale.value = localStorage.getItem('appLocale') || 'fr';
};

onMounted(() => {
    window.addEventListener('app-locale-changed', syncLocale);
});

onUnmounted(() => {
    window.removeEventListener('app-locale-changed', syncLocale);
});
</script>

<template>
   
    <v-locale-provider :locale="locale">
        <v-app>
            <MainView />
            <v-main>
                <v-container fluid class="page-wrapper">
                    <div class="maxWidth">
                        <RouterView />
                    </div>
                </v-container>
            </v-main>
        </v-app>
    </v-locale-provider>
</template>