<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import BaseBreadcrumb from '@/components/shared/BaseBreadcrumb.vue';
import UiParentCard from '@/components/shared/UiParentCard.vue';
import axiosInstance from '@/utils/axios';
import { useToast } from 'vue-toastification';
import { PrinterIcon, EyeIcon } from 'vue-tabler-icons';

const toast = useToast();
const page = ref({ title: 'Historique Global des Opérations' });
const breadcrumbs = ref([
    { title: 'Rapports', disabled: false, href: '#' },
    { title: 'Historique Global', disabled: true, href: '#' }
]);

const loading = ref(true);
const movements = ref<any[]>([]);
const search = ref('');
const filterType = ref('ALL'); // ALL, ENTREE, SORTIE
const selectedYear = ref(new Date().getFullYear());
const yearOptions = computed(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, i) => current - i);
});
const currentUser = ref<any>(null);
const company = ref<any>(null);
const profils = ref<any[]>([]);
const isViewDialogOpen = ref(false);
const selectedGroup = ref<any>(null);
const printTypeOrder = ['informatique', 'bancaire', 'bureau', 'entretien', 'electrique', 'autres'];
const printTypeLabels: Record<string, string> = {
    informatique: 'Informatique',
    bancaire: 'Bancaire',
    bureau: 'Bureau',
    entretien: 'Entretien',
    electrique: 'Electrique',
    autres: 'Autres'
};

const headers = [
    { title: 'Date', key: 'date', align: 'start' as const },
    { title: 'N° Ordre', key: 'num_ordre', align: 'start' as const },
    { title: 'Type', key: 'type', align: 'center' as const },
    { title: 'Nb Lignes', key: 'nb_lignes', align: 'end' as const },
    { title: 'Quantité Totale', key: 'quantite_totale', align: 'end' as const },
    { title: 'Valeur Totale', key: 'valeur_totale', align: 'end' as const },
    { title: 'Tiers / Observation', key: 'tiers', align: 'start' as const },
    { title: 'Actions', key: 'actions', align: 'end' as const, sortable: false },
];

const fetchData = async () => {
    loading.value = true;
    try {
        // On récupère les entrées et les sorties en parallèle
        // Note: On suppose ici que ces endpoints existent et retournent toutes les données
        const [entriesRes, exitsRes, productsRes, usersRes, suppliersRes, categoriesRes] = await Promise.all([
            axiosInstance.get('/stock/entries'),
            axiosInstance.get('/stock/exits'),
            axiosInstance.get('/products'),
            axiosInstance.get('/users'),
            axiosInstance.get('/fournisseurs'),
            axiosInstance.get('/categories')
        ]);

        const products = productsRes.data;
        const users = usersRes.data;
        const suppliers = suppliersRes.data;
        const categories = categoriesRes.data;

        // Filtrage des produits selon le rÃ´le/agence/pÃ´le
        let allowedProductIds = new Set<string>();
        const profileId = currentUser.value?.id_profil || currentUser.value?.profil_id || currentUser.value?.profil?.id_profil;
        const userProfile = profils.value.find(p => p.id_profil === profileId);
        const role = userProfile?.nom?.toLowerCase();
        let isRestricted = false;

        if (role && !['direction', 'contrÃ´le', 'controle'].some(r => role.includes(r))) {
            const userAgence = currentUser.value?.agence;
            const userPoleId = currentUser.value?.id_pole || currentUser.value?.pole_id || currentUser.value?.pole?.id_pole;

            if (userAgence || userPoleId) {
                isRestricted = true;
                products.forEach((p: any) => {
                    const matchAgence = userAgence && p.agence === userAgence;
                    const matchPole = userPoleId && p.id_pole === userPoleId;
                    if (matchAgence || matchPole) {
                        allowedProductIds.add(p.id_product);
                    }
                });
            }
        }

        const getProductName = (id: string) => {
            const p = products.find((x: any) => x.id_product === id);
            return p ? p.nom : 'Inconnu';
        };
        const getProductPrice = (id: string) => {
            const p = products.find((x: any) => x.id_product === id);
            return p ? Number(p.prix) : 0;
        };
        const getProductConditionnement = (id: string) => {
            const p = products.find((x: any) => x.id_product === id);
            return p?.conditionnement || '';
        };
        const getUserName = (id: string) => {
            const u = users.find((x: any) => x.id_users === id);
            return u ? u.name : 'Utilisateur inconnu';
        };
        const getSupplierName = (id: string) => {
            const s = suppliers.find((x: any) => x.id_fournisseur === id);
            return s ? s.nom : id || 'Fournisseur inconnu';
        };
        const getProductCategoryType = (id: string) => {
            const p = products.find((x: any) => x.id_product === id);
            if (!p?.id_categorie) return 'Non defini';
            const c = categories.find((x: any) => x.id_categorie === p.id_categorie);
            return c?.type || 'Non defini';
        };

        // Normalisation des entrées
        const entriesData = isRestricted ? entriesRes.data.filter((e: any) => allowedProductIds.has(e.id_product)) : entriesRes.data;
        const entries = entriesData.map((e: any) => {
            const prixUnitaire = Number(e.prix_achat) || getProductPrice(e.id_product) || 0;
            return {
                id: `IN-${e.id_entrees_stocks}`,
                num_ordre: e.num_ordre || '-',
                date: new Date(e.date_reception),
                product_name: e.product ? e.product.nom : getProductName(e.id_product),
                conditionnement: getProductConditionnement(e.id_product),
                type: 'ENTREE',
                product_type: getProductCategoryType(e.id_product),
                quantite: e.quantite_entree,
                prix: prixUnitaire,
                valeur_totale: (e.quantite_entree * prixUnitaire),
                tiers: getSupplierName(e.fournisseur || e.id_fournisseur)
            };
        });

        // Normalisation des sorties
        const exitsData = isRestricted ? exitsRes.data.filter((s: any) => allowedProductIds.has(s.id_product)) : exitsRes.data;
        const exits = exitsData.map((s: any) => {
            const prixUnitaire = getProductPrice(s.id_product) || 0;
            return {
                id: `OUT-${s.id_sortie_stock}`,
                num_ordre: s.num_ordre || '-',
                date: new Date(s.date_sortie),
                product_name: s.product ? s.product.nom : getProductName(s.id_product),
                conditionnement: getProductConditionnement(s.id_product),
                type: 'SORTIE',
                product_type: getProductCategoryType(s.id_product),
                quantite: s.quantite_sortie,
                prix: prixUnitaire,
                valeur_totale: (s.quantite_sortie * prixUnitaire),
                tiers: s.user ? s.user.name : (s.id_users ? getUserName(s.id_users) : 'Sortie de stock')
            };
        });

        // Fusion et tri par date décroissante
        movements.value = [...entries, ...exits].sort((a, b) => b.date.getTime() - a.date.getTime());

    } catch (error) {
        console.error(error);
        toast.error("Erreur lors du chargement de l'historique.");
    } finally {
        loading.value = false;
    }
};

const fetchCurrentUser = async () => {
    try {
        const response = await axiosInstance.get('/user');
        currentUser.value = response.data;
    } catch (error) {
        console.error("Erreur chargement utilisateur", error);
    }
};

const fetchCompany = async () => {
    if (currentUser.value && currentUser.value.id_entreprise) {
        try {
            const response = await axiosInstance.get(`/entreprises/${currentUser.value.id_entreprise}`);
            company.value = response.data;
        } catch (error) {
            console.error("Erreur chargement entreprise", error);
        }
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

const getImageUrl = (path: string | null) => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('data:')) return path;
    return `${import.meta.env.VITE_API_URL || 'https://api.inventory.cremin-cam.org'}${path}`;
};

const filteredMovements = computed(() => {
    const groupsMap = new Map<string, any>();

    movements.value.forEach((m: any) => {
        const groupOrder = m.num_ordre && m.num_ordre !== '-' ? m.num_ordre : m.id;
        const groupKey = `${m.type}__${groupOrder}`;

        if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
                id: groupKey,
                num_ordre: m.num_ordre || '-',
                type: m.type,
                date: m.date,
                lines: [],
                nb_lignes: 0,
                quantite_totale: 0,
                valeur_totale: 0,
                tiers_set: new Set<string>()
            });
        }

        const group = groupsMap.get(groupKey);
        group.lines.push(m);
        group.nb_lignes += 1;
        group.quantite_totale += Number(m.quantite) || 0;
        group.valeur_totale += Number(m.valeur_totale) || 0;
        group.tiers_set.add(m.tiers || '-');

        if (m.date && new Date(m.date).getTime() > new Date(group.date).getTime()) {
            group.date = m.date;
        }
    });

    let data = Array.from(groupsMap.values()).map((g: any) => ({
        ...g,
        tiers: Array.from(g.tiers_set).join(', ')
    }));

    if (filterType.value !== 'ALL') {
        data = data.filter((m: any) => m.type === filterType.value);
    }
    data = data.filter((m: any) => new Date(m.date).getFullYear() === selectedYear.value);

    if (search.value) {
        const s = search.value.toLowerCase();
        data = data.filter((m: any) =>
            m.num_ordre.toLowerCase().includes(s) ||
            m.tiers.toLowerCase().includes(s) ||
            m.lines.some((line: any) => (line.product_name || '').toLowerCase().includes(s))
        );
    }

    return data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value);
};

const getTypeBucket = (typeLabel: string) => {
    const t = (typeLabel || '').toLowerCase();
    if (t.includes('informat')) return 'informatique';
    if (t.includes('bancair')) return 'bancaire';
    if (t.includes('bureau')) return 'bureau';
    if (t.includes('entretien')) return 'entretien';
    if (t.includes('electri') || t.includes('electri')) return 'electrique';
    return 'autres';
};

const escapeHtml = (value: string) => {
    return (value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

const exportToExcel = () => {
    const rows = filteredMovements.value;
    if (!rows.length) {
        toast.warning("Aucune donnée Ã  exporter.");
        return;
    }

    let totalGeneral = 0;
    const bodyRows = rows.map((item: any, index: number) => {
        totalGeneral += Number(item.valeur_totale) || 0;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(new Date(item.date).toLocaleDateString())}</td>
                <td>${escapeHtml(item.num_ordre || '-')}</td>
                <td>${escapeHtml(item.type || '-')}</td>
                <td style="text-align:right;">${item.nb_lignes ?? 0}</td>
                <td style="text-align:right;">${item.quantite_totale ?? 0}</td>
                <td style="text-align:right;">${item.valeur_totale ?? 0}</td>
                <td>${escapeHtml(item.tiers || '-')}</td>
            </tr>
        `;
    }).join('');

    const tableHtml = `
        <html>
            <head><meta charset="UTF-8" /></head>
            <body>
                <table border="1" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>NÂ°</th>
                            <th>Date</th>
                            <th>NÂ° Ordre</th>
                            <th>Type</th>
                            <th>Nb lignes</th>
                            <th>Quantité totale</th>
                            <th>Valeur totale</th>
                            <th>Tiers / Observation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr>
                            <td colspan="6" style="text-align:right;"><strong>Total général</strong></td>
                            <td style="text-align:right;"><strong>${totalGeneral}</strong></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filterLabel = (filterType.value || 'ALL').toLowerCase();
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `historique-global-${filterLabel}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const exportGroupToExcel = (group: any) => {
    const rows = group?.lines || [];
    if (!rows.length) {
        toast.warning("Aucune ligne Ã  exporter.");
        return;
    }

    let totalGeneral = 0;
    const bodyRows = rows.map((line: any, index: number) => {
        const value = Number(line.valeur_totale) || 0;
        totalGeneral += value;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(new Date(line.date).toLocaleDateString())}</td>
                <td>${escapeHtml(group.num_ordre || '-')}</td>
                <td>${escapeHtml(line.product_name || '-')}</td>
                <td>${escapeHtml(line.conditionnement || '-')}</td>
                <td style="text-align:right;">${line.quantite ?? 0}</td>
                <td style="text-align:right;">${line.prix ?? 0}</td>
                <td style="text-align:right;">${value}</td>
                <td>${escapeHtml(group.tiers || '-')}</td>
            </tr>
        `;
    }).join('');

    const tableHtml = `
        <html>
            <head><meta charset="UTF-8" /></head>
            <body>
                <table border="1" style="border-collapse:collapse;">
                    <thead>
                        <tr>
                            <th>NÂ°</th>
                            <th>Date</th>
                            <th>NÂ° Ordre</th>
                            <th>Produit</th>
                            <th>Conditionnement</th>
                            <th>Quantité</th>
                            <th>Prix unitaire</th>
                            <th>Valeur totale</th>
                            <th>Tiers / Observation</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr>
                            <td colspan="7" style="text-align:right;"><strong>Total général</strong></td>
                            <td style="text-align:right;"><strong>${totalGeneral}</strong></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>
            </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const typeLabel = (group.type || 'mouvement').toLowerCase();
    const orderLabel = (group.num_ordre || 'sans-numero').replace(/[^\w-]/g, '_');
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `historique-${typeLabel}-${orderLabel}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const printMovement = (item: any) => {
    const itemsToPrint = item.lines || [];
    if (!itemsToPrint.length) return;

    const totalDocumentValue = itemsToPrint.reduce((sum: number, curr: any) => sum + curr.valeur_totale, 0);
    const isEntry = item.type === 'ENTREE';
    const title = isEntry ? 'BON DE RECEPTION' : 'BON DE SORTIE';
    const tiersLabel = isEntry ? 'Fournisseur' : 'Beneficiaire';
    const color = isEntry ? '#4caf50' : '#ff9800';
    const logoUrl = company.value && company.value.logo ? getImageUrl(company.value.logo) : '';

    const grouped: Record<string, any[]> = {
        informatique: [],
        bancaire: [],
        bureau: [],
        entretien: [],
        electrique: [],
        autres: []
    };
    itemsToPrint.forEach((line: any) => {
        grouped[getTypeBucket(line.product_type || '')].push(line);
    });

    let sectionsHtml = '';
    printTypeOrder.forEach((key) => {
        const rows = grouped[key];
        if (!rows.length) return;

        const rowsHtml = rows.map((line: any) => `
            <tr>
                <td style="padding: 12px; border: 1px solid #ddd;">${line.product_name}</td>
                <td style="padding: 12px; border: 1px solid #ddd;">${line.conditionnement || '-'}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${line.quantite}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${formatCurrency(line.prix)}</td>
                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${formatCurrency(line.valeur_totale)}</td>
            </tr>
        `).join('');
        const sectionTotal = rows.reduce((sum: number, line: any) => sum + (Number(line.valeur_totale) || 0), 0);

        sectionsHtml += `
            <h3 style="margin: 20px 0 10px; color: #1f2937;">Type: ${printTypeLabels[key]}</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Designation</th>
                        <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Conditionnement</th>
                        <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Quantite</th>
                        <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Prix Unitaire</th>
                        <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    <tr style="background-color: #f9f9f9; font-weight: bold;">
                        <td colspan="4" style="padding: 12px; border: 1px solid #ddd; text-align: right;">TOTAL ${printTypeLabels[key].toUpperCase()}</td>
                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">${formatCurrency(sectionTotal)}</td>
                    </tr>
                </tbody>
            </table>
        `;
    });

    const content = `
        <div style="font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; border: 1px solid #eee;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid ${color}; padding-bottom: 20px;">
                <div>
                    ${logoUrl ? `<img src="${logoUrl}" style="max-height: 80px; max-width: 200px;" />` : ''}
                </div>
                <div style="text-align: right;">
                    <h1 style="margin: 0; color: ${color}; font-size: 24px;">${title}</h1>
                    <p style="margin: 5px 0; color: #666;">#${item.num_ordre}</p>
                    <p style="margin: 5px 0;">Date : ${item.date.toLocaleDateString()}</p>
                </div>
            </div>

            <div style="margin-bottom: 30px; background: #f9f9f9; padding: 20px; border-radius: 4px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <strong>${tiersLabel} :</strong>
                    <span>${item.tiers || '-'}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <strong>Type de mouvement :</strong>
                    <span>${item.type}</span>
                </div>
            </div>

            ${sectionsHtml}
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tbody>
                    <tr style="background-color: #f9f9f9; font-weight: bold;">
                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">TOTAL GENERAL</td>
                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right; width: 200px;">${formatCurrency(totalDocumentValue)}</td>
                    </tr>
                </tbody>
            </table>

            <div style="margin-top: 50px; display: flex; justify-content: space-between;">
                <div style="text-align: center;">
                    <p><strong>Signature Directeur General</strong></p>
                    <div style="height: 60px;"></div>
                </div>
                <div style="text-align: center;">
                    <p><strong>Signature ${tiersLabel}</strong></p>
                    <div style="height: 60px;"></div>
                </div>
            </div>

            <div style="margin-top: 30px; font-size: 12px; color: #999; text-align: center;">
                Imprime le ${new Date().toLocaleString()}
            </div>
        </div>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
        printWindow.document.write(`<html><head><title>${title} - ${item.id}</title></head><body>${content}</body></html>`);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    }
};
const openViewDialog = (group: any) => {
    selectedGroup.value = group;
    isViewDialogOpen.value = true;
};

onMounted(async () => {
    await fetchCurrentUser();
    await Promise.all([fetchCompany(), fetchProfils()]);
    await fetchData();
});
</script>

<template>
    <BaseBreadcrumb :title="page.title" :breadcrumbs="breadcrumbs"></BaseBreadcrumb>
    <v-row>
        <v-col cols="12">
            <UiParentCard title="Mouvements de stock" style="padding: 2rem;">
                <template v-slot:action>
                    <div class="d-flex gap-2 align-center">
                        <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportToExcel">Exporter Excel</v-btn>
                        <v-select
                            v-model="selectedYear"
                            :items="yearOptions"
                            label="Année"
                            variant="outlined"
                            density="compact"
                            hide-details
                            style="max-width: 120px;"
                        />
                        <v-btn-toggle v-model="filterType" mandatory density="compact" color="primary" variant="outlined">
                            <v-btn value="ALL">Tout</v-btn>
                            <v-btn value="ENTREE">Entrées</v-btn>
                            <v-btn value="SORTIE">Sorties</v-btn>
                        </v-btn-toggle>
                    </div>
                </template>

                <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="Rechercher un produit ou un tiers..." variant="outlined" density="compact" hide-details class="mb-4"></v-text-field>

                <v-data-table :headers="headers" :items="filteredMovements" :loading="loading" density="comfortable" hover>
                    <template v-slot:item.date="{ item }">
                        {{ item.date.toLocaleDateString() }}
                    </template>
                    <template v-slot:item.type="{ item }">
                        <v-chip :color="item.type === 'ENTREE' ? 'success' : 'warning'" size="small" label>
                            {{ item.type }}
                        </v-chip>
                    </template>
                    <template v-slot:item.quantite_totale="{ item }">
                        {{ item.quantite_totale }}
                    </template>
                    <template v-slot:item.valeur_totale="{ item }">
                        {{ formatCurrency(item.valeur_totale) }}
                    </template>
                    <template v-slot:item.actions="{ item }">
                        <v-btn icon variant="text" color="primary" size="small" title="Consulter les lignes" @click="openViewDialog(item)">
                            <EyeIcon size="20" />
                        </v-btn>
                        <v-btn icon variant="text" color="secondary" size="small" title="Imprimer le bon" @click="printMovement(item)">
                            <PrinterIcon size="20" />
                        </v-btn>
                    </template>
                </v-data-table>
            </UiParentCard>
        </v-col>
    </v-row>

    <v-dialog v-model="isViewDialogOpen" max-width="900">
        <v-card v-if="selectedGroup">
            <v-card-title class="d-flex justify-space-between align-center">
                <span>Détail du lot #{{ selectedGroup.num_ordre }}</span>
                <v-btn icon="mdi-close" variant="text" @click="isViewDialogOpen = false"></v-btn>
            </v-card-title>
            <v-card-text>
                <div class="mb-3">
                    <strong>Type:</strong> {{ selectedGroup.type }} |
                    <strong>Date:</strong> {{ selectedGroup.date.toLocaleDateString() }} |
                    <strong>Tiers:</strong> {{ selectedGroup.tiers }}
                </div>

                <v-table density="comfortable">
                    <thead>
                        <tr>
                            <th class="text-left">Produit</th>
                            <th class="text-left">Conditionnement</th>
                            <th class="text-right">Quantité</th>
                            <th class="text-right">Prix Unitaire</th>
                            <th class="text-right">Valeur Totale</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="line in selectedGroup.lines" :key="line.id">
                            <td>{{ line.product_name }}</td>
                            <td>{{ line.conditionnement || '-' }}</td>
                            <td class="text-right">{{ line.quantite }}</td>
                            <td class="text-right">{{ formatCurrency(line.prix) }}</td>
                            <td class="text-right">{{ formatCurrency(line.valeur_totale) }}</td>
                        </tr>
                        <tr>
                            <td class="text-right font-weight-bold" colspan="4">Total</td>
                            <td class="text-right font-weight-bold">{{ formatCurrency(selectedGroup.valeur_totale) }}</td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card-text>
            <v-card-actions class="justify-end">
                <v-btn color="success" variant="outlined" prepend-icon="mdi-file-excel" @click="exportGroupToExcel(selectedGroup)">Exporter Excel</v-btn>
                <v-btn color="secondary" variant="outlined" prepend-icon="mdi-printer" @click="printMovement(selectedGroup)">Imprimer</v-btn>
                <v-btn color="primary" @click="isViewDialogOpen = false">Fermer</v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>
