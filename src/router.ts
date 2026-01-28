import {createRouter, createWebHashHistory} from "vue-router";

const routes = [
    {
        path: "/",
        component: () => import("./layouts/Main.vue"),
        children: [
            {path: "", component: () => import("./pages/Home.vue")},
            {path: "home", component: () => import("./pages/Home.vue")},
            {path: "server", component: () => import("./pages/Server.vue")},
            {path: "video", component: () => import("./pages/Video.vue")},
            {path: "sound", component: () => import("./pages/Sound.vue")},
            {path: "tool", component: () => import("./pages/Tool.vue")},
            {path: "live", component: () => import("./pages/Live.vue")},
            {path: "setting", component: () => import("./pages/Setting.vue")},
        ],
    },
    {
        path: "/",
        component: () => import("./layouts/Raw.vue"),
        children: [],
    },
];

const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

// watch router change
router.beforeEach((to, from, next) => {
    window.$mapi?.statistics?.tick("visit", {
        path: to.path,
    });
    next();
});

export default router;
