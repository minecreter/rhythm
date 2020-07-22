import Vue from "vue";
import VueRouter from "vue-router";
import VueMoment from "vue-moment";
import App from "./App.vue";
import router from "./helpers/router";
import { store } from "./helpers/store";
import * as fb from "./helpers/firebaseConfig";
import Icon from "vue-awesome/components/Icon.vue";
import "animate.css";

Vue.config.productionTip = false;
Vue.config.devtools = process.env.NODE_ENV === "development";

Vue.use(VueMoment);
Vue.use(VueRouter);
Vue.component("v-icon", Icon);

new Vue({
  router,
  store,
  created() {
    fb.auth.onAuthStateChanged(async (user) => {
      console.log("User state changed", user);
      await this.$store.commit("setCurrentUser", user);
      if (!user && !this.$store.state.redirecting) {
        console.warn("User not logged in, creating anonymous profile...");
        fb.auth.signInAnonymously().catch((error) => {
          console.error(error.message);
        });
      }
    });
  },
  render: (h) => h(App),
}).$mount("#app");