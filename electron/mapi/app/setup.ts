import {Permissions} from "../../lib/permission";

export const SetupMain = {
    async isOk() {
        return true;
    },
    async list() {
        return [
            {
                name: "accessibility",
                title: t("setup.accessibility.title"),
                status: (await Permissions.checkAccessibilityAccess()) ? "success" : "fail",
                desc: t("setup.accessibility.desc"),
                steps: [
                    {
                        title: t("setup.accessibility.step"),
                        image: "/setup/accessibility.png",
                    },
                ],
            },
            {
                name: "screen",
                title: t("setup.screen.title"),
                status: (await Permissions.checkScreenCaptureAccess()) ? "success" : "fail",
                desc: t("setup.screen.desc"),
                steps: [
                    {
                        title: t("setup.screen.step"),
                        image: "/setup/screen.png",
                    },
                ],
            },
        ];
    },
    async open(name: string) {
        switch (name) {
            case "accessibility":
                Permissions.askAccessibilityAccess().then();
                break;
            case "screen":
                Permissions.askScreenCaptureAccess().then();
                break;
        }
    },
};
