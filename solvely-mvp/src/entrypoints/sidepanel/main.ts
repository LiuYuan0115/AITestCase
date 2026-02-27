import { createApp } from 'vue';
import App from './App.vue';
import { vTooltip } from '@/directives/tooltip';

const app = createApp(App);
app.directive('tooltip', vTooltip);
app.mount('#app');



