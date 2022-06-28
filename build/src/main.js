"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const contentful_management_1 = require("contentful-management");
const inquirer = require("inquirer");
const ProgressBar = require("progress");
const yargs = require("yargs");
async function main() {
    const argv = await yargs
        .env()
        .option("space-id", {
        type: "string",
        describe: "Contentful space id",
        demandOption: true,
    })
        .option("env", {
        type: "string",
        describe: "Contentful environment",
        demandOption: true,
    })
        .option("accesstoken", {
        type: "string",
        describe: "Contentful access token",
        demandOption: true,
    })
        .option("batch-size", {
        type: "number",
        describe: "Number of parallel Contentful requests",
        default: 5,
    })
        .option("content-type", {
        type: "string",
        describe: "Specify the entries to delete from the specified content type",
        default: '',
    })
        .option("delete-content-types", {
        type: "boolean",
        describe: "Delete content types as well",
        default: false,
    })
        .option("assets", {
        type: "boolean",
        describe: "Delete assets as well",
        default: false,
    })
        .option("yes", {
        type: "boolean",
        describe: "Auto-confirm delete prompt",
        alias: "y",
        default: false,
    })
        .option("verbose", {
        type: "boolean",
        alias: "v",
        default: false,
    })
        .version(false)
        .parse();
    const accessToken = argv["accesstoken"];
    const spaceId = argv["space-id"];
    const verbose = argv["verbose"];
    const batchSize = argv["batch-size"];
    const removeContentTypes = argv["delete-content-types"];
    const isAssets = argv["assets"];
    const yes = argv["yes"];
    const contentType = argv["content-type"];
    const env = argv["env"] || "master";
    const contentfulManagementClient = (0, contentful_management_1.createClient)({
        accessToken,
    });
    const contentfulSpace = await contentfulManagementClient.getSpace(spaceId);
    const selectedEnvironment = await contentfulSpace.getEnvironment(env);
    const entriesMetadata = await selectedEnvironment.getEntries({
        content_type: contentType || undefined,
        include: 0,
        limit: 0,
    });
    let totalEntries = entriesMetadata.total;
    console.log(`Deleting ${totalEntries} entries`);
    console.log(`Using space "${spaceId}" (${contentfulSpace.name})`);
    console.log(`Using environment "${env}"`);
    console.log(`For content-type "${contentType}"`);
    console.log(`Total Entries Found: ${entriesMetadata.total}`);
    if (!yes) {
        if (!(await promptForEntriesConfirmation(spaceId, env)))
            return;
    }
    await deleteEntries(totalEntries, batchSize, verbose, selectedEnvironment, contentType);
    if (removeContentTypes) {
        if (!yes) {
            if (!(await promptForContentTypesConfirmation(spaceId, env)))
                return;
        }
        await deleteContentTypes(contentfulSpace, batchSize, verbose, env);
    }
    if (isAssets) {
        if (!yes) {
            if (!(await promptForAssetsConfirmation(spaceId, env)))
                return;
        }
        await deleteAssets(contentfulSpace, batchSize, verbose, env);
    }
}
exports.main = main;
async function promptForEntriesConfirmation(spaceId, environment) {
    const prompt = await inquirer.prompt([
        {
            type: "confirm",
            name: "yes",
            message: `Do you really want to delete all targeted entries from space ${spaceId}:${environment}?`,
        },
    ]);
    return prompt.yes;
}
async function promptForContentTypesConfirmation(spaceId, environment) {
    const prompt = await inquirer.prompt([
        {
            type: "confirm",
            name: "yes",
            message: `Do you really want to delete all content types from space ${spaceId}:${environment}?`,
        },
    ]);
    return prompt.yes;
}
async function promptForAssetsConfirmation(spaceId, environment) {
    const prompt = await inquirer.prompt([
        {
            type: "confirm",
            name: "yes",
            message: `Do you really want to delete all assets/media from space ${spaceId}:${environment}?`,
        },
    ]);
    return prompt.yes;
}
async function deleteEntries(totalEntries, batchSize, verbose, selectedEnvironment, contentType) {
    // tslint:disable-next-line:max-line-length
    const entriesProgressBar = new ProgressBar("Deleting entries [:bar], rate: :rate/s, done: :percent, time left: :etas", { total: totalEntries });
    do {
        const entries = await selectedEnvironment.getEntries({
            content_type: contentType || undefined,
            include: 0,
            limit: batchSize,
        });
        totalEntries = entries.total;
        const promises = [];
        for (const entry of entries.items) {
            const promise = unpublishAndDeleteEntry(entry, entriesProgressBar, verbose);
            promises.push(promise);
        }
        await Promise.all(promises);
    } while (totalEntries > batchSize);
}
async function unpublishAndDeleteEntry(entry, progressBar, verbose) {
    try {
        if (entry.isPublished()) {
            if (verbose)
                console.log(`Unpublishing entry "${entry.sys.id}"`);
            await entry.unpublish();
        }
        if (verbose)
            console.log(`Deleting entry '${entry.sys.id}"`);
        await entry.delete();
    }
    catch (e) {
        console.log(e);
        // Continue if something went wrong with Contentful
    }
    finally {
        progressBar.tick();
    }
}
async function deleteContentTypes(contentfulSpace, batchSize, verbose, environment) {
    const selectedEnvironment = await contentfulSpace.getEnvironment(environment);
    const contentTypesMetadata = await selectedEnvironment.getContentTypes({
        include: 0,
        limit: 0,
    });
    let totalContentTypes = contentTypesMetadata.total;
    console.log(`Deleting ${totalContentTypes} content types`);
    // tslint:disable-next-line:max-line-length
    const contentTypesProgressBar = new ProgressBar("Deleting content types [:bar], rate: :rate/s, done: :percent, time left: :etas", { total: totalContentTypes });
    do {
        const contentTypes = await selectedEnvironment.getContentTypes({
            include: 0,
            limit: batchSize,
        });
        totalContentTypes = contentTypes.total;
        const promises = [];
        for (const contentType of contentTypes.items) {
            const promise = unpublishAndDeleteContentType(contentType, contentTypesProgressBar, verbose);
            promises.push(promise);
        }
        await Promise.all(promises);
    } while (totalContentTypes > batchSize);
}
async function unpublishAndDeleteContentType(contentType, progressBar, verbose) {
    try {
        if (contentType.isPublished()) {
            if (verbose)
                console.log(`Unpublishing content type "${contentType.sys.id}"`);
            await contentType.unpublish();
        }
        if (verbose)
            console.log(`Deleting content type '${contentType.sys.id}"`);
        await contentType.delete();
    }
    catch (e) {
        console.log(e);
        // Continue if something went wrong with Contentful
    }
    finally {
        progressBar.tick();
    }
}
async function deleteAssets(contentfulSpace, batchSize, verbose, environment) {
    const selectedEnvironment = await contentfulSpace.getEnvironment(environment);
    const assetsMetadata = await selectedEnvironment.getAssets({
        include: 0,
        limit: 0,
    });
    let totalAssets = assetsMetadata.total;
    console.log(`Deleting ${totalAssets} assets/media`);
    // tslint:disable-next-line:max-line-length
    const entriesProgressBar = new ProgressBar("Deleting assets [:bar], rate: :rate/s, done: :percent, time left: :etas", { total: totalAssets });
    do {
        const assets = await selectedEnvironment.getAssets({
            include: 0,
            limit: batchSize,
        });
        totalAssets = assets.total;
        const promises = [];
        for (const asset of assets.items) {
            const promise = unpublishAndDeleteEntry(asset, entriesProgressBar, verbose);
            promises.push(promise);
        }
        await Promise.all(promises);
    } while (totalAssets > batchSize);
}
//# sourceMappingURL=main.js.map