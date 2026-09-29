import { createApp } from 'vue'
import { createVuetify } from 'vuetify'
import { VApp, VDataTable, VLayout, VMain, VNavigationDrawer } from 'vuetify/components'
import {
	ArcElement,
	BarElement,
	BubbleController,
	CategoryScale,
	Chart as ChartJS,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from 'chart.js'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import './styles/chanell.css'
import App from './App.vue'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, BubbleController, LineController, Tooltip, Legend, Filler)

const vuetify = createVuetify({
	components: { VApp, VDataTable, VLayout, VMain, VNavigationDrawer },
	theme: {
		defaultTheme: 'light',
		themes: {
			light: {
				dark: false,
				colors: { primary: '#050505', secondary: '#333333', background: '#FFFFFF', surface: '#FFFFFF' },
			},
		},
	},
})

createApp(App).use(vuetify).mount('#app')
