import {
    AlertCircleIcon,
    AlertHexagonIcon,
    AlignBoxBottomLeftIcon,
    ApertureIcon,
    AppsIcon,
    AppWindowIcon,
    BasketIcon,
    BorderAllIcon,
    BorderHorizontalIcon,
    BorderInnerIcon,
    BorderStyle2Icon,
    BorderTopIcon,
    BorderVerticalIcon,
    BoxAlignBottomIcon,
    BoxAlignLeftIcon,
    BoxIcon,
    BoxModelIcon,
    BuildingArchIcon,
    BrandTidalIcon,
    CalendarIcon,
    CardboardsIcon,
    Category2Icon,
    ChartArcsIcon,
    ChartAreaIcon,
    ChartCandleIcon,
    ChartDonut3Icon,
    ChartDotsIcon,
    ChartLineIcon,
    ChartRadarIcon,
    ColumnsIcon,
    CopyIcon,
    CurrencyDollarIcon,
    EditIcon,
    EyeTableIcon,
    FileCheckIcon,
    FileDotsIcon,
    FilesIcon,
    FileTextIcon,
    FilterIcon,
    HelpIcon,
    JumpRopeIcon,
    LayoutDashboardIcon,
    LayoutKanbanIcon,
    ListIcon,
    LoginIcon,
    MailIcon,
    Message2Icon,
    MoodHappyIcon,
    PageBreakIcon,
    PhotoAiIcon,
    PointIcon,
    RotateIcon,
    RowInsertBottomIcon,
    SearchIcon,
    ServerIcon,
    SettingsIcon,
    ShoppingCartIcon,
    SocialIcon,
    SortAscendingIcon,
    TableIcon,
    TicketIcon,
    TypographyIcon,
    UserCircleIcon,
    UserIcon,
    UserPlusIcon,
    UserShieldIcon,
    ZoomCodeIcon,
    ReportAnalyticsIcon,
    HistoryIcon
} from 'vue-tabler-icons';

export interface menu {
    header?: string;
    title?: string;
    i18nKey?: string;
    icon?: any;
    to?: string;
    chip?: string;
    chipColor?: string;
    chipBgColor?: string;
    chipVariant?: string;
    chipIcon?: string;
    children?: menu[];
    disabled?: boolean;
    type?: string;
    subCaption?: string;
    external?: boolean;
    roles?: string[];
}

const sidebarItem: menu[] = [
    { header: 'Home', i18nKey: 'sidebar.header.home' },
    {
        title: 'Dashboard',
        i18nKey: 'sidebar.dashboard',
        icon: LayoutDashboardIcon,
        to: '/',
        external: false,
        roles: ['Admin', 'Agent', 'Agence', 'Controle', 'Direction']
    },

    { header: 'PRODUCTS', i18nKey: 'sidebar.header.products' },
    {
        title: 'List Categories',
        i18nKey: 'sidebar.listCategories',
        icon: Category2Icon,
        to: '/products/list-categories',
        external: false,
        roles: ['Admin', 'Direction']
    },
    {
        title: 'List Products',
        i18nKey: 'sidebar.listProducts',
        icon: ListIcon,
        to: '/products/list-products',
        external: false,
        roles: ['Admin', 'Agence', 'Controle', 'Direction']
    },
    {
        title: 'Requests',
        i18nKey: 'sidebar.requests',
        icon: ShoppingCartIcon,
        to: '/products/requests',
        external: false,
        roles: ['Admin', 'Agent', 'Agence', 'Controle', 'Direction']
    },

    { header: 'Utilisateurs', i18nKey: 'sidebar.header.users' },
    {
        title: 'List Users',
        i18nKey: 'sidebar.listUsers',
        icon: UserIcon,
        to: '/users/list-users',
        external: false,
        roles: ['Admin', 'Direction', 'Controle']
    },
    {
        title: 'Roles & Permissions',
        i18nKey: 'sidebar.rolesPermissions',
        icon: UserShieldIcon,
        to: '/users/roles-permissions',
        external: false,
        roles: ['Admin']
    },
    {
        title: 'My Profile',
        i18nKey: 'sidebar.myProfile',
        icon: UserIcon,
        to: '/users/profile',
        external: false,
        roles: ['Agent']
    },
    {
        title: 'Rapport Utilisateurs',
        i18nKey: 'sidebar.userReport',
        icon: ReportAnalyticsIcon,
        to: '/users/report',
        external: false,
        roles: ['Admin', 'Direction', 'Controle']
    },
    

    { header: 'RAPPORTS', i18nKey: 'sidebar.header.reports', roles: ['Admin', 'Direction', 'Controle', 'Agence'] },
    {
        title: 'Rapport Agent',
        i18nKey: 'sidebar.agentReport',
        icon: ReportAnalyticsIcon,
        to: '/users/agent-report',
        external: false,
        roles: ['Agent']
    },
    {
        title: 'Historique Global',
        i18nKey: 'sidebar.globalHistory',
        icon: HistoryIcon,
        to: '/products/global-history',
        external: false,
        roles: ['Admin', 'Direction', 'Controle', 'Agence']
    },
    {
        title: 'Valorisation Stock',
        i18nKey: 'sidebar.stockValuation',
        icon: ReportAnalyticsIcon,
        to: '/products/stock-valuation',
        external: false,
        roles: ['Admin', 'Direction', 'Controle']
    },
    {
        title: 'Etat Stock Periode',
        i18nKey: 'sidebar.stockStatePeriod',
        icon: ReportAnalyticsIcon,
        to: '/products/stock-state-report',
        external: false,
        roles: ['Admin', 'Direction', 'Controle', 'Agence']
    },
    
    { header: 'Extra', i18nKey: 'sidebar.header.extra' },
    {
        title: 'Parameters',
        i18nKey: 'sidebar.parameters',
        icon: SettingsIcon,
        to: '/settings/company',
        external: false,
        roles: ['Admin', 'Direction', 'Controle', 'Agent']
    },
    {
        title: 'Gestion des Pôles',
        i18nKey: 'sidebar.polesManagement',
        icon: BoxModelIcon,
        to: '/settings/poles',
        external: false,
        roles: ['Admin']
    },
    {
        title: 'Gestion des Ordonnances',
        i18nKey: 'sidebar.ordersManagement',
        icon:   FileTextIcon,
        to: '/settings/orders',
        external: false,
        roles: ['Admin','Direction','Controle']
    },
    {
        title: 'Notifications',
        i18nKey: 'sidebar.notifications',
        icon: AlertCircleIcon,
        to: '/extra/notifications',
        external: false,
        roles: ['Admin', 'Agent', 'Agence', 'Controle', 'Direction']
    }
];

export default sidebarItem;

/**
 * Filtre les éléments du menu en fonction du rôle de l'utilisateur.
 * Gère la récursivité pour les sous-menus.
 */
export const filterSidebarItems = (items: menu[], userRole: string): menu[] => {
    const role = userRole ? userRole.toLowerCase() : '';
    
    return items.reduce((acc: menu[], item) => {
        // 1. Vérifier si l'élément courant est autorisé (insensible à la casse)
        const isAllowed = !item.roles || item.roles.length === 0 || item.roles.some(r => r.toLowerCase() === role);
        
        if (item.header || isAllowed) {
            // 2. Si l'élément a des enfants, filtrer les enfants récursivement
            if (item.children) {
                const filteredChildren = filterSidebarItems(item.children, userRole);
                // Si l'élément est un parent (pas de lien direct) et qu'il n'a plus d'enfants après filtrage, on le cache
                if (filteredChildren.length > 0 || item.to) {
                    acc.push({ ...item, children: filteredChildren });
                }
            } else {
                // Pas d'enfants, on ajoute l'élément s'il est autorisé
                acc.push(item);
            }
        }
        return acc;
    }, []);
};
