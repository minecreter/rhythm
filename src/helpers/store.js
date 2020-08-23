import Vue from "vue";
import Vuex from "vuex";
import { usersCollection, analytics, auth } from "./firebaseConfig";
import md5 from "js-md5";

Vue.use(Vuex);

export const store = new Vuex.Store({
  state: {
    audio: null,
    gModal: null,
    bg: null,
    currentUser: null,
    userProfile: {},
    profilePicture: null,
    authed: false,
    verified: false,
    initialized: false,
    isFullscreen: false,
    visualizerArr: null,
    visualizerIns: null,
    theme: null,
    redirecting: false,
    ytVars: {
      controls: 0,
      rel: 0,
      playsinline: 1,
      disablekb: 1,
      autoplay: 0,
      modestbranding: 1,
      nocookie: true,
    },
    appVersion: process.env.APP_VERSION,
    build: process.env.COMMIT_HASH,
  },
  actions: {
    async fetchUserProfile() {
      if (this.state.currentUser && !this.state.currentUser.isAnonymous) {
        await this.dispatch("updateUserProfile");
        await this.dispatch("fetchProfilePicture");
      } else {
        this.commit("setUserProfile", null);
        this.commit("setProfilePciture", null);
        this.commit("setTheme");
      }
    },
    async fetchProfilePicture({ commit, state }) {
      if (state.currentUser) {
        let url = state.currentUser.photoURL;
        if (url) {
          commit("setProfilePciture", url);
        } else {
          let hash = md5(state.currentUser.email);
          let gravatar_link =
            "https://www.gravatar.com/avatar/" + hash + "?s=50&d=404";
          let response = await fetch(gravatar_link);
          if (response.status === 200) {
            commit("setProfilePciture", gravatar_link);
          } else {
            commit("setProfilePciture", null);
          }
        }
      }
    },
    async updateUserProfile({ commit, state }) {
      if (state.currentUser) {
        try {
          const res = await usersCollection.doc(state.currentUser.uid).get();
          let data = res.data();
          commit("setUserProfile", data ?? {});
          commit("setTheme");
          state.initialized = true;
          analytics().logEvent("app_initialized");
        } catch (err) {
          Logger.error(err);
        }
        // update display name and photo for first time login
        const user = auth.currentUser;
        const providerDisplayName =
          state.currentUser.providerData?.[0]?.displayName;
        let reloadRequired = false;
        if (!state.currentUser.displayName && providerDisplayName) {
          state.redirecting = true;
          await user.updateProfile({ displayName: providerDisplayName });
          reloadRequired = true;
          Logger.warn("Display name updated using provider data");
        }
        const providerPhoto = state.currentUser.providerData?.[0]?.photoURL;
        if (!state.currentUser.photoURL && providerPhoto) {
          state.redirecting = true;
          await user.updateProfile({ photoURL: providerPhoto });
          Logger.warn("Photo URL updated using provider data");
          reloadRequired = true;
        }
        if (reloadRequired) window.location.reload();
      }
    },
  },
  mutations: {
    setCurrentUser(state, val) {
      state.authed = val && !val.isAnonymous && val.providerData?.length > 0;
      state.verified = state.authed && val.emailVerified;
      state.currentUser = val;
      this.dispatch("fetchUserProfile");
      if (!val) return;
      const { uid, displayName, emailVerified, isAnonymous } = val;
      analytics().setUserId(uid);
      analytics().setUserProperties({
        displayName,
        emailVerified,
        isAnonymous,
      });
    },
    setUserProfile(state, val) {
      state.userProfile = val;
      if (val && val.exp) {
        let level = calculateUserLevel(val.exp);
        state.userProfile.lvBefore = state.userProfile.lv ?? level;
        state.userProfile.lv = level;
        state.userProfile.lvd = Math.floor(level);
        if (val.appearanceSt?.syncYoutube) state.ytVars.nocookie = false;
      }
    },
    setTheme(state) {
      // set themes
      const darkPurple = {
        visualizer: "purpleSpace",
        buttonStyle: "colored",
        logoAsset: "logo2.png",
      };
      const flameOrange = {
        visualizer: "space",
        buttonStyle: "",
        logoAsset: "logo.png",
      };
      const userTheme = state.userProfile?.appearanceSt;
      state.theme =
        userTheme?.theme === "flameOrange" ? flameOrange : darkPurple;
      if (userTheme) {
        state.theme.visualizer = userTheme.visualizer;
        state.theme.blur = userTheme.blur;
        state.theme.themeStyle = userTheme.options?.themeStyle;
      }
    },
    setThemePreview(state, val) {
      console.log(val);
      Object.assign(state.theme, val);
    },
    setProfilePciture(state, val) {
      state.profilePicture = val;
    },
    setAudio(state, val) {
      state.audio = val;
    },
    setGlobalModal(state, val) {
      state.gModal = val;
    },
    setFloatingAlert(state, val) {
      state.alert = val;
    },
    setBackground(state, val) {
      state.bg = val;
    },
    setVisualizerArr(state, val) {
      state.visualizerArr = val;
    },
    setVisualizerIns(state, val) {
      state.visualizerIns = val;
    },
    async toggleFullscreen(state) {
      state.isFullscreen = document.fullscreen;
      if (state.isFullscreen) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      state.isFullscreen = document.fullscreen;
    },
    checkFullscreen(state) {
      state.isFullscreen = document.fullscreen;
    },
  },
});

function calculateUserLevel(exp) {
  //ref https://stackoverflow.com/questions/6954874/
  const lvInc = 10;
  return (Math.sqrt(lvInc * lvInc + 100 * exp) - lvInc) / 30 + 1;
}

// partly ref https://savvyapps.com/blog/definitive-guide-building-web-app-vuejs-firebase
