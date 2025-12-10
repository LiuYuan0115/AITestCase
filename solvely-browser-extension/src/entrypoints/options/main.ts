import { createApp } from 'vue'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import App from './App.vue'

const app = createApp(App)

// 配置 PrimeVue
app.use(PrimeVue, {
  theme: {
    preset: Aura
  }
})

app.mount('#app-root') 