<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';

const toast = useToast();
const page = ref({ title: 'Mon Profil' });
const breadcrumbs = ref([
    {
        title: 'Utilisateurs',
        disabled: false,
        href: '#'
    },
    {
        title: 'Mon Profil',
        disabled: true,
        href: '#'
    }
]);

const loading = ref(false);
const MAX_UPLOAD_SIZE = 2 * 1024 * 1024; // 2 Mo
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const userModel = ref({
    id_users: '',
    name: '',
    email: '',
    phone_number: '',
    poste: '',
    matricule: '',
    agence: '',
    link_img: '',
    signature: '',
    profil_id: null,
});

// Fichiers temporaires pour l'upload
const profileImage = ref<any>(null);
const signatureImage = ref<any>(null);
const profils = ref<any[]>([]);
const signatureCanvas = ref<HTMLCanvasElement | null>(null);
const isDrawing = ref(false);
const hasDrawnSignature = ref(false);
const drawnSignatureDataUrl = ref<string | null>(null);

const setupSignatureCanvas = () => {
    const canvas = signatureCanvas.value;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = canvas.clientWidth || 500;
    const height = canvas.clientHeight || 150;
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111827';
};

const getCanvasPoint = (event: PointerEvent) => {
    const canvas = signatureCanvas.value;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
    };
};

const startDrawSignature = (event: PointerEvent) => {
    const canvas = signatureCanvas.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(event);
    isDrawing.value = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    canvas.setPointerCapture?.(event.pointerId);
};

const drawSignature = (event: PointerEvent) => {
    if (!isDrawing.value) return;
    const canvas = signatureCanvas.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasDrawnSignature.value = true;
};

const endDrawSignature = (event?: PointerEvent) => {
    if (!isDrawing.value) return;
    isDrawing.value = false;
    if (event && signatureCanvas.value) {
        signatureCanvas.value.releasePointerCapture?.(event.pointerId);
    }
    if (signatureCanvas.value && hasDrawnSignature.value) {
        drawnSignatureDataUrl.value = signatureCanvas.value.toDataURL('image/png');
    }
};

const clearDrawnSignature = () => {
    const canvas = signatureCanvas.value;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnSignature.value = false;
    drawnSignatureDataUrl.value = null;
};

const dataUrlToBlob = (dataUrl: string) => {
    const parts = dataUrl.split(',');
    const header = parts[0];
    const base64 = parts[1];
    const mimeMatch = header.match(/data:(.*?);base64/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
};

const fetchUserProfile = async () => {
    loading.value = true;
    try {
        const response = await axiosInstance.get('/user');
        const data = response.data;
        console.log("Données utilisateur récupérées avec succès:", data);

        userModel.value = {
            id_users: data.id_users,
            name: data.name,
            email: data.email,
            phone_number: data.phone_number || '',
            poste: data.poste || '',
            matricule: data.matricule || '',
            agence: data.agence || '',
            link_img: data.link_img || '',
            signature: data.signature || '',
            profil_id: data.profil_id || (data.profil ? data.profil.id_profil : null),
        };
    } catch (error) {
        toast.error("Impossible de charger les informations du profil.");
        console.error(error);
    } finally {
        loading.value = false;
    }
};

const fetchProfils = async () => {
    try {
        const response = await axiosInstance.get('/profils');
        profils.value = response.data;
    } catch (error) {
        console.error("Erreur chargement profils", error);
    }
};

const normalizeSelectedFile = (value: any): File | null => {
    const file = Array.isArray(value) ? value[0] : value;
    return file instanceof File ? file : null;
};

const validateUploadFile = (file: File | null, label: string) => {
    if (!file) return false;
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(`${label} : format invalide. Utilisez JPG, PNG ou WEBP.`);
        return false;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
        toast.error(`${label} : fichier trop volumineux (max 2 Mo).`);
        return false;
    }
    return true;
};

const saveProfile = async () => {
    loading.value = true;
    try {
        // Upload de la photo de profil si modifiée
        const pFile = normalizeSelectedFile(profileImage.value);
        if (pFile) {
            if (!validateUploadFile(pFile, 'Photo de profil')) return;
            const formData = new FormData();
            formData.append('file', pFile);
            const response = await axiosInstance.post('/users/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            userModel.value.link_img = response.data.path;
        }
        // Upload de la signature si modifiée
        const sFile = normalizeSelectedFile(signatureImage.value);
        if (sFile) {
            if (!validateUploadFile(sFile, 'Signature')) return;
            const formData = new FormData();
            formData.append('file', sFile);
            const response = await axiosInstance.post('/users/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            userModel.value.signature = response.data.path;
        } else if (drawnSignatureDataUrl.value && hasDrawnSignature.value) {
            const blob = dataUrlToBlob(drawnSignatureDataUrl.value);
            if (blob.size > MAX_UPLOAD_SIZE) {
                toast.error('Signature dessinée : fichier trop volumineux (max 2 Mo).');
                return;
            }
            const formData = new FormData();
            formData.append('file', blob, `signature-${Date.now()}.png`);
            const response = await axiosInstance.post('/users/upload-media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            userModel.value.signature = response.data.path;
        }

        // Mise à jour des informations du profil

        await axiosInstance.put(`/users/${userModel.value.id_users}`, userModel.value);
        toast.success("Profil mis à jour avec succès !");
        
        // Rafraîchir les données et vider les champs de fichier
        await fetchUserProfile();
        profileImage.value = null;
        signatureImage.value = null;
        clearDrawnSignature();
        
    } catch (error: any) {
        const status = error?.response?.status;
        if (status === 413) {
            toast.error("Fichier trop volumineux pour le serveur. Réduisez la taille de l'image.");
        } else {
            toast.error("Erreur lors de la mise à jour du profil.");
        }
        console.error(error);
    } finally {
        loading.value = false;
    }
};

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    const apiBase = String(import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org/api').replace(/\/+$/, '');
    const cleanedPath = `/${String(path).replace(/^\/+/, '')}`;
    return `${apiBase}${cleanedPath}`;
};

const printPage = () => {
    window.print();
};

onMounted(() => {
    fetchUserProfile();
    fetchProfils();
    nextTick(() => {
        setupSignatureCanvas();
    });
    window.addEventListener('resize', setupSignatureCanvas);
});

onUnmounted(() => {
    window.removeEventListener('resize', setupSignatureCanvas);
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12" md="4">
            <UiParentCard title="Photo de profil" style="padding: 2rem;">
                <div class="d-flex flex-column align-center pt-4">
                    <v-avatar size="130" color="primary" variant="tonal" class="mb-6 profile-avatar">
                        <v-img v-if="userModel.link_img" :src="getImageUrl(userModel.link_img)" class="profile-avatar-img" contain></v-img>
                        <v-icon v-else size="60">mdi-account</v-icon>
                    </v-avatar>
                    
                    <v-file-input v-model="profileImage" label="Changer la photo" variant="outlined" density="compact" prepend-icon="mdi-camera" accept="image/*" class="w-100" hide-details></v-file-input>
                    <div class="text-caption text-medium-emphasis mt-2 text-center">Formats: JPG, PNG. Max 2Mo.</div>
                </div>
            </UiParentCard>
            
            <UiParentCard title="Signature" class="mt-6" style="padding: 2rem;">
                <div class="d-flex flex-column align-center pt-2">
                    <div class="mb-4 border border-dashed pa-4 rounded w-100 d-flex justify-center align-center bg-grey-lighten-5" style="height: 100px;">
                        <v-img v-if="userModel.signature" :src="getImageUrl(userModel.signature)" class="signature-preview" contain></v-img>
                        <div v-else class="text-medium-emphasis font-italic text-caption">Aucune signature</div>
                    </div>

                    <div class="w-100 mb-3">
                        <div class="text-caption text-medium-emphasis mb-2">Signer avec la souris / le doigt</div>
                        <canvas
                            ref="signatureCanvas"
                            class="signature-canvas"
                            @pointerdown="startDrawSignature"
                            @pointermove="drawSignature"
                            @pointerup="endDrawSignature"
                            @pointerleave="endDrawSignature"
                            @pointercancel="endDrawSignature"
                        ></canvas>
                        <div class="d-flex justify-end mt-2">
                            <v-btn size="small" variant="text" color="error" @click="clearDrawnSignature">Effacer la signature</v-btn>
                        </div>
                    </div>
                    
                    <v-file-input v-model="signatureImage" label="Téléverser une signature" variant="outlined" density="compact" prepend-icon="mdi-pen" accept="image/*" class="w-100" hide-details></v-file-input>
                </div>
            </UiParentCard>
        </v-col>
        
        <v-col cols="12" md="8">
            <UiParentCard title="Informations personnelles" style="padding: 2rem;">
                <template v-slot:action>
                    <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printPage">Imprimer / PDF</v-btn>
                </template>
                <v-form @submit.prevent="saveProfile" class="mt-2">
                    <h6 class="text-subtitle-1 font-weight-bold mb-4">Identité</h6>
                    <v-row>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Nom complet</v-label><v-text-field v-model="userModel.name" variant="outlined" color="primary" density="comfortable"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Email</v-label><v-text-field v-model="userModel.email" variant="outlined" color="primary" density="comfortable" readonly disabled bg-color="grey-lighten-4"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Téléphone</v-label><v-text-field v-model="userModel.phone_number" variant="outlined" color="primary" density="comfortable"></v-text-field></v-col>
                    </v-row>

                    <v-divider class="my-6"></v-divider>

                    <h6 class="text-subtitle-1 font-weight-bold mb-4">Informations Professionnelles</h6>
                    <v-row>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Poste / Fonction</v-label><v-text-field v-model="userModel.poste" variant="outlined" color="primary" density="comfortable"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Matricule</v-label><v-text-field v-model="userModel.matricule" variant="outlined" color="primary" density="comfortable"></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Agence</v-label><v-text-field v-model="userModel.agence" variant="outlined" color="primary" density="comfortable" readonly disabled></v-text-field></v-col>
                        <v-col cols="12" md="6"><v-label class="font-weight-medium mb-2">Profil (Rôle)</v-label><v-select v-model="userModel.profil_id" :items="profils" item-title="nom" item-value="id_profil" variant="outlined" color="primary" density="comfortable" readonly disabled bg-color="grey-lighten-4"></v-select></v-col>
                    </v-row>

                    <div class="d-flex justify-end mt-6">
                        <v-btn color="primary" type="submit" :loading="loading" size="large" flat>Enregistrer les modifications</v-btn>
                    </div>
                </v-form>
            </UiParentCard>
        </v-col>
    </v-row>
</template>

<style scoped>
.profile-avatar {
    border: 1px solid #e5e7eb;
}

.profile-avatar-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #f8fafc;
}

.signature-preview {
    width: 100%;
    height: 90px;
    object-fit: contain;
}

.signature-canvas {
    width: 100%;
    height: 150px;
    border: 1px dashed #9ca3af;
    border-radius: 8px;
    background: #fff;
    cursor: crosshair;
    touch-action: none;
}
</style>
