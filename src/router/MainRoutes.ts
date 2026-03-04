const MainRoutes = {
    path: '/',
    meta: {
        requiresAuth: true
    },
    redirect: '/auth/login',
    component: () => import('@/layouts/full/FullLayout.vue'),
    children: [
        {
            name: 'Dashboard',
            path: '/',
            component: () => import('@/views/dashboard/index.vue'),
        },
        {
            name: 'ListCategories',
            path: '/products/list-categories',
            component: () => import('@/views/products/ListCategories.vue')
        },
        {
            name: 'ListProducts',
            path: '/products/list-products',
            component: () => import('@/views/products/ListProducts.vue')
        },
        {
            name: 'ProductDetails',
            path: '/products/details/:id',
            component: () => import('@/views/products/ProductDetails.vue')
        },
        {
            name: 'Demandes',
            path: '/products/requests',
            component: () => import('@/views/products/Requests.vue')
        },
        {
            name: 'ListUsers',
            path: '/users/list-users',
            component: () => import('@/views/users/ListUsers.vue')
        },
        {
            name: 'RolesPermissions',
            path: '/users/roles-permissions',
            component: () => import('@/views/users/RolesPermissions.vue')
        },
        {
            name: 'UserProfile',
            path: '/users/profile',
            component: () => import('@/views/users/UserProfile.vue')
        },
        {
            name: 'ChangePassword',
            path: '/users/change-password',
            component: () => import('@/views/users/ChangePassword.vue')
        },
        {
            name: 'RapportUser',
            path: '/users/report',
            component: () => import('@/views/users/RapportUser.vue')
        },
        {
            name: 'AgentReport',
            path: '/users/agent-report',
            component: () => import('@/views/users/AgentReport.vue')
        },
        {
            name: 'CompanySettings',
            path: '/settings/company',
            component: () => import('@/views/settings/CompanySettings.vue')
        },
        {
            name: 'GlobalHistory',
            path: '/products/global-history',
            component: () => import('@/views/products/GlobalHistory.vue')
        },
        {
            name: 'StockValuation',
            path: '/products/stock-valuation',
            component: () => import('@/views/products/StockValuation.vue')
        },
        {
            name: 'StockStateReport',
            path: '/products/stock-state-report',
            component: () => import('@/views/products/StockStateReport.vue')
        },
        {
            name: 'SettingsPoles',
            path: '/settings/poles',
            component: () => import('@/views/settings/ListPoles.vue')
        },
        {
            name: 'Ordonnances',
            path: '/settings/orders',
            component: () => import('@/views/settings/OrdersManage.vue')
        },
        {
            name: 'Notifications',
            path: '/extra/notifications',
            component: () => import('@/views/extra/Notifications.vue')
        },
        {
            name: 'Tables',
            path: '/ui/tables',
            component: () => import('@/views/ui-components/Tables.vue')
        },
        {
            name: 'Starter',
            path: '/sample-page',
            component: () => import('@/views/pages/SamplePage.vue')
        },
    ]
};

export default MainRoutes;
