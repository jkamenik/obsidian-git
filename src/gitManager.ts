import { App } from "obsidian";
import ObsidianGit from "./main";
import { BranchInfo, FileStatusResult, Status, TreeItem } from "./types";


export abstract class GitManager {
    readonly plugin: ObsidianGit;
    readonly app: App;
    constructor(plugin: ObsidianGit) {
        this.plugin = plugin;
        this.app = plugin.app;
    }

    abstract status(): Promise<Status>;

    abstract commitAll(message?: string): Promise<number>;

    abstract commit(message?: string): Promise<number>;

    abstract stageAll(): Promise<void>;

    abstract unstageAll(): Promise<void>;

    abstract stage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract unstage(filepath: string, relativeToVault: boolean): Promise<void>;

    abstract discard(filepath: string): Promise<void>;

    abstract pull(): Promise<FileStatusResult[]>;

    abstract push(): Promise<number>;

    abstract canPush(): Promise<boolean>;

    abstract checkRequirements(): Promise<"valid" | "missing-repo" | "missing-git">;

    abstract branchInfo(): Promise<BranchInfo>;

    abstract checkout(branch: string): Promise<void>;

    abstract init(): Promise<void>;

    abstract clone(url: string, dir: string): Promise<void>;

    abstract setConfig(path: string, value: any): Promise<void>;

    abstract getConfig(path: string): Promise<any>;

    abstract fetch(remote?: string): Promise<void>;

    abstract setRemote(name: string, url: string): Promise<void>;

    abstract getRemotes(): Promise<string[]>;

    abstract getRemoteUrl(remote: string): Promise<string>;

    abstract getRemoteBranches(remote: string): Promise<string[]>;

    abstract removeRemote(remoteName: string): Promise<void>;

    abstract updateUpstreamBranch(remoteBranch: string): Promise<void>;

    abstract updateGitPath(gitPath: string): void;

    abstract updateBasePath(basePath: string): void;

    abstract getDiffString(filePath: string, stagedChanges: boolean): Promise<string>;


    getVaultPath(path: string): string {
        if (this.plugin.settings.basePath) {
            return this.plugin.settings.basePath + "/" + path;
        } else {
            return path;
        }
    }

    getPath(path: string, relativeToVault: boolean): string {
        return (relativeToVault && this.plugin.settings.basePath.length > 0) ? path.substring(this.plugin.settings.basePath.length + 1) : path;
    }

    getTreeStructure(children: FileStatusResult[], beginLength: number = 0): TreeItem[] {
        let list: TreeItem[] = [];
        children = [...children];
        while (children.length > 0) {
            const first = children.first();
            const restPath = first.path.substring(beginLength);
            if (restPath.contains("/")) {
                const title = restPath.substring(0, restPath.indexOf("/"));
                const childrenWithSameTitle = children.filter((item) => {
                    return item.path.substring(beginLength).startsWith(title + "/");
                });
                childrenWithSameTitle.forEach((item) => children.remove(item));
                list.push({
                    title: title,
                    children: this.getTreeStructure(childrenWithSameTitle, (beginLength > 0 ? (beginLength + title.length) : title.length) + 1)
                });
            } else {
                list.push({ title: restPath, statusResult: first });
                children.remove(first);
            }
        }
        return list;
    }

    async formatCommitMessage(template: string): Promise<string> {
        let status: Status | undefined;
        if (template.includes("{{numFiles}}")) {
            status = await this.status();
            let numFiles = status.staged.length;
            template = template.replace("{{numFiles}}", String(numFiles));
        }
        if (template.includes("{{hostname}}")) {
            const hostname = localStorage.getItem(this.plugin.manifest.id + ":hostname") || "";
            template = template.replace("{{hostname}}", hostname);
        }

        if (template.includes("{{files}}")) {
            status = status ?? await this.status();

            let changeset: { [key: string]: string[]; } = {};
            status.staged.forEach((value: FileStatusResult) => {
                if (value.index in changeset) {
                    changeset[value.index].push(value.path);
                } else {
                    changeset[value.index] = [value.path];
                }
            });

            let chunks = [];
            for (let [action, files] of Object.entries(changeset)) {
                chunks.push(action + " " + files.join(" "));
            }

            let files = chunks.join(", ");

            template = template.replace("{{files}}", files);
        }

        let moment = (window as any).moment;
        template = template.replace(
            "{{date}}",
            moment().format(this.plugin.settings.commitDateFormat)
        );
        if (this.plugin.settings.listChangedFilesInMessageBody) {
            template = template + "\n\n" + "Affected files:" + "\n" + (status ?? await this.status()).staged.map((e) => e.path).join("\n");
        }
        return template;
    }
}
