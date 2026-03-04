<script setup lang="ts">
import { onMounted, ref, shallowRef, watch, computed } from 'vue'; // Ajout de 'computed'
import { useDisplay, useTheme } from "vuetify"; // Ajout de 'useTheme'
import sidebarItems, { filterSidebarItems } from './vertical-sidebar/sidebarItem';
import NavGroup from './vertical-sidebar/NavGroup/index.vue';
import NavItem from './vertical-sidebar/NavItem/index.vue';
import Logo from './logo/Logo.vue';
// Icon Imports
import {
    Menu2Icon,
    SunIcon, // Icône pour le thème clair
    MoonIcon, // Icône pour le thème sombre
    LanguageIcon, // Icône pour la langue
} from 'vue-tabler-icons';
// dropdown imports
import ProfileDD from './vertical-header/ProfileDD.vue';
import NavCollapse from './vertical-sidebar/NavCollapse/NavCollapse.vue';
import axiosInstance from '@/utils/axios';
import { useI18n } from 'vue-i18n';

const sidebarMenu = shallowRef(sidebarItems);

const { mdAndDown } = useDisplay(); // Destructuration pour mdAndDown
const sDrawer = ref(true);
const currentUserName = ref('');
const currentUserDisplayName = computed(() => {
    const parts = (currentUserName.value || '').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ');
});
const { locale } = useI18n();
const currentLocaleLabel = computed(() => locale.value.toUpperCase());

const toggleLanguage = () => {
    const next = locale.value === 'fr' ? 'en' : 'fr';
    locale.value = next;
    localStorage.setItem('appLocale', next);
    window.dispatchEvent(new Event('app-locale-changed'));
};

onMounted(async () => {
    sDrawer.value = !mdAndDown.value; // hide on mobile, show on desktop

    try {
        // Récupération de l'utilisateur et de son rôle
        const { data: user } = await axiosInstance.get('/user');
        currentUserName.value = user?.name || user?.email || '';
        let roleName = '';

        // Logique robuste pour trouver le nom du rôle
        const profileId = user.id_profil || user.profil_id || user.profil?.id_profil;
        
        if (user.profil && user.profil.nom) {
            roleName = user.profil.nom;
        } else if (profileId) {
            const { data: profils } = await axiosInstance.get('/profils');
            const profil = profils.find((p: any) => p.id_profil === profileId);
            if (profil) roleName = profil.nom;
        }

        // Application du filtre sur le menu
        sidebarMenu.value = filterSidebarItems(sidebarItems, roleName);
    } catch (error) {
        console.error("Erreur lors du chargement du menu filtré", error);
        // En cas d'erreur, on garde le menu par défaut (sidebarItems)
    }
});
watch(mdAndDown, (val) => {
    sDrawer.value = !val;
});

// Logique de bascule de thème
const theme = useTheme();
const isDarkTheme = computed(() => theme.global.name.value === 'dark');

const toggleTheme = () => {
    theme.global.name.value = isDarkTheme.value ? 'light' : 'dark';
};

</script>

<template>
    <!------Sidebar-------->
    <v-navigation-drawer left elevation="0" app class="leftSidebar mt-0" :width="270" v-model="sDrawer">
        <!---Logo part -->
        <div class="">
            <Logo />
        </div>
        <!-- ---------------------------------------------- -->
        <!---Navigation -->
        <!-- ---------------------------------------------- -->
        <div>
            <perfect-scrollbar class="scrollnavbar">
                <v-list class="pa-6">
                    <!---Menu Loop -->
                    <template v-for="(item, i) in sidebarMenu" :key="`${item.header || item.title || 'item'}-${i}`">
                        <!---Item Sub Header -->
                        <NavGroup :item="item" v-if="item.header" :key="`header-${i}`" />

                        <NavCollapse class="leftPadding" :item="item" :level="0" v-else-if="item.children" :key="`collapse-${item.title || i}`" />
                        <!---Single Item-->
                        <NavItem :item="item" v-else class="leftPadding" :key="`item-${item.to || item.title || i}`" />
                        <!---End Single Item-->
                    </template>
                </v-list>
                <div class="pa-4">
                </div>
            </perfect-scrollbar>
        </div>

    </v-navigation-drawer>
    <!------Header-------->
    <v-app-bar elevation="0" height="70" class="top-header">
        <div class="d-flex align-center justify-space-between w-100">
            <div>
                <v-btn class="ms-md-3 ms-sm-5 ms-3 text-muted" @click="sDrawer = !sDrawer" icon variant="flat"
                    size="small">
                    <Menu2Icon size="20" stroke-width="1.5" />
                </v-btn>
            </div>
            <!-- Partie droite de l'en-tête -->
            <div>
                <!-- Bouton de bascule de thème -->
                <v-btn icon variant="text" class="custom-hover-primary ml-0 ml-md-5 text-muted" @click="toggleTheme">
                    <SunIcon v-if="isDarkTheme" stroke-width="1.5" size="22" />
                    <MoonIcon v-else stroke-width="1.5" size="22" />
                </v-btn>

                <!-- Bouton de langue -->
                <v-btn icon variant="text" class="custom-hover-primary ml-0 ml-md-5 text-muted" @click="toggleLanguage">
                    <LanguageIcon stroke-width="1.5" size="22" />
                </v-btn>
                <span class="text-caption text-medium-emphasis">{{ currentLocaleLabel }}</span>

                <span class="ml-3 text-subtitle-2 text-medium-emphasis" v-if="currentUserDisplayName">
                    {{ currentUserDisplayName }}
                </span>
                <!-- User Profile -->
                <ProfileDD />
            </div>
        </div>
    </v-app-bar>
</template>
