import { EventTypes } from "../pages/Live/util";

export type LiveStatusType =
    "stopped" | "starting" | "running" | "stopping" | "error";

export type LiveMaterialProblemType =
    "voice" | "avatar" | "flowTalk" | "flowVideo";

export type LiveKnowledgeSystemType = (typeof EventTypes)[number]["value"];

export type LiveKnowledgeContentType = {
    enable: boolean;
    type: "flowVideo" | "flowTalk" | "user" | "system";
    systemType: LiveKnowledgeSystemType;
    tags: [];
    keywords: string;
    reply: string;
    replies: {
        value: string;
    }[];
    url: string;
};
