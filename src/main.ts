import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import vuetify from './plugins/vuetify';
import '@/scss/style.scss';
import PerfectScrollbar from 'vue3-perfect-scrollbar';
import VueApexCharts from 'vue3-apexcharts';
import VueTablerIcons from 'vue-tabler-icons';

import Toast from 'vue-toastification';

// Import the CSS for the toast notifications
import 'vue-toastification/dist/index.css';



const app = createApp(App);
app.use(router);
app.use(PerfectScrollbar);
app.use(VueTablerIcons);
app.use(VueApexCharts);


// Add the Toast plugin to your app
app.use(Toast, {
    // You can add default options here
    transition: "Vue-Toastification__bounce",
    maxToasts: 5,
    newestOnTop: true
});
app.use(vuetify).mount('#app');