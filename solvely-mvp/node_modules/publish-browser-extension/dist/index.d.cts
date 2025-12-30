import { z } from 'zod/v4';

declare const InlineConfig: z.ZodObject<{
    dryRun: z.ZodOptional<z.ZodBoolean>;
    chrome: z.ZodOptional<z.ZodObject<{
        zip: z.ZodOptional<z.ZodString>;
        extensionId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
        clientSecret: z.ZodOptional<z.ZodString>;
        refreshToken: z.ZodOptional<z.ZodString>;
        publishTarget: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            default: "default";
            trustedTesters: "trustedTesters";
        }>>>;
        deployPercentage: z.ZodOptional<z.ZodOptional<z.ZodInt>>;
        reviewExemption: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        skipSubmitReview: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
    }, z.core.$strip>>;
    firefox: z.ZodOptional<z.ZodObject<{
        zip: z.ZodOptional<z.ZodString>;
        sourcesZip: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        extensionId: z.ZodOptional<z.ZodString>;
        jwtIssuer: z.ZodOptional<z.ZodString>;
        jwtSecret: z.ZodOptional<z.ZodString>;
        channel: z.ZodOptional<z.ZodDefault<z.ZodEnum<{
            listed: "listed";
            unlisted: "unlisted";
        }>>>;
    }, z.core.$strip>>;
    edge: z.ZodOptional<z.ZodObject<{
        zip: z.ZodOptional<z.ZodString>;
        productId: z.ZodOptional<z.ZodString>;
        clientId: z.ZodOptional<z.ZodString>;
        skipSubmitReview: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
        apiKey: z.ZodOptional<z.ZodString>;
        clientSecret: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        accessTokenUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
type InlineConfig = z.infer<typeof InlineConfig>;
interface CustomEnv {
    DRY_RUN: string | undefined;
    CHROME_CLIENT_ID: string | undefined;
    CHROME_CLIENT_SECRET: string | undefined;
    CHROME_DEPLOY_PERCENTAGE: string | undefined;
    CHROME_EXTENSION_ID: string | undefined;
    CHROME_PUBLISH_TARGET: string | undefined;
    CHROME_REFRESH_TOKEN: string | undefined;
    CHROME_REVIEW_EXEMPTION: string | undefined;
    CHROME_SKIP_SUBMIT_REVIEW: string | undefined;
    CHROME_ZIP: string | undefined;
    FIREFOX_ZIP: string | undefined;
    FIREFOX_SOURCES_ZIP: string | undefined;
    FIREFOX_EXTENSION_ID: string | undefined;
    FIREFOX_JWT_ISSUER: string | undefined;
    FIREFOX_JWT_SECRET: string | undefined;
    FIREFOX_CHANNEL: string | undefined;
    EDGE_ZIP: string | undefined;
    EDGE_PRODUCT_ID: string | undefined;
    EDGE_CLIENT_ID: string | undefined;
    /** @deprecated since Edge API v1.1 release */
    EDGE_CLIENT_SECRET: string | undefined;
    /** @deprecated since Edge API v1.1 release */
    EDGE_ACCESS_TOKEN_URL: string | undefined;
    EDGE_API_KEY: string | undefined;
    EDGE_SKIP_SUBMIT_REVIEW: string | undefined;
}
declare global {
    namespace NodeJS {
        interface ProcessEnv extends CustomEnv {
        }
    }
}

interface SubmitSuccess {
    success: true;
}
interface SubmitFailure {
    success: false;
    err: any;
}
type SubmitResult = SubmitSuccess | SubmitFailure;
interface Store {
    /**
     * Submit the ZIP file to the store.
     */
    submit(dryRun: boolean): Promise<void>;
    /**
     * Throw an error if the provided files do not exist.
     */
    ensureZipsExist(): Promise<void>;
}

declare function submit(config: InlineConfig): Promise<SubmitResults>;
type SubmitResults = Partial<Record<keyof Omit<InlineConfig, 'dryRun'>, SubmitResult>>;

declare function init(config: InlineConfig): Promise<void>;

interface AddonsApiOptions {
    jwtIssuer: string;
    jwtSecret: string;
}
interface AddonPagination<T> {
    page_size: number;
    page_count: number;
    count: number;
    next?: string;
    previous?: string;
    results: T[];
}
interface AddonDetails {
    id: string;
}
interface UploadDetails {
    uuid: string;
    channel: AddonChannel;
    processed: boolean;
    submitted: boolean;
    url: string;
    valid: boolean;
    validation: {
        errors: number;
        warnings: number;
        notices: number;
    };
    version: string;
}
interface AddonVersion {
    id: number;
}
interface AddonVersion {
    id: number;
    file: {
        id: number;
    };
}
type AddonChannel = 'listed' | 'unlisted';
declare class AddonsApi {
    readonly options: AddonsApiOptions;
    constructor(options: AddonsApiOptions);
    private addonDetailEndpoint;
    private addonsUploadCreateEndpoint;
    private addonsUploadDetailsEndpoint;
    private addonVersionCreateEndpoint;
    /**
     * Docs: https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#detail
     */
    details(params: {
        extensionId: string;
    }): Promise<AddonDetails>;
    /**
     * Docs: https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-create
     */
    uploadCreate(params: {
        file: string;
        channel: AddonChannel;
    }): Promise<UploadDetails>;
    /**
     * Docs: https://addons-server.readthedocs.io/en/latest/topics/api/addons.html#upload-detail
     */
    uploadDetail(params: {
        uuid: string;
    }): Promise<UploadDetails>;
    versionCreate(params: {
        extensionId: string;
        uploadUuid: string;
        sourceFile?: string;
    }): Promise<AddonVersion>;
    /**
     * See https://addons-server.readthedocs.io/en/latest/topics/api/auth.html
     */
    private createJwt;
    private getAuthHeader;
}

declare const FirefoxAddonStoreOptions: z.ZodObject<{
    zip: z.ZodString;
    sourcesZip: z.ZodOptional<z.ZodString>;
    extensionId: z.ZodString;
    jwtIssuer: z.ZodString;
    jwtSecret: z.ZodString;
    channel: z.ZodDefault<z.ZodEnum<{
        listed: "listed";
        unlisted: "unlisted";
    }>>;
}, z.core.$strip>;
type FirefoxAddonStoreOptions = z.infer<typeof FirefoxAddonStoreOptions>;
declare class FirefoxAddonStore implements Store {
    readonly options: FirefoxAddonStoreOptions;
    readonly setStatus: (text: string) => void;
    private api;
    constructor(options: FirefoxAddonStoreOptions, setStatus: (text: string) => void);
    ensureZipsExist(): Promise<void>;
    submit(dryRun?: boolean): Promise<void>;
    private uploadAndPollValidation;
    /**
     * Ensure the extension id is wrapped in curly braces, that's what the addon store API is expecting
     * @example
     * "test" -> "{test}"
     */
    private get wrappedExtensionId();
}

type EdgeApiOptions = {
    productId: string;
    clientId: string;
    apiKey: string;
};
interface EdgeTokenDetails {
    access_token: string;
    expires_in: number;
    token_type: string;
}
interface DraftResponse {
    operationId: string;
}
/**
 * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/addons-api-reference#response-1
 */
interface DraftOperation {
    id: string;
    createdTime: string;
    lastUpdatedTime: string;
    status: 'InProgress' | 'Succeeded' | 'Failed';
    message: string | null;
    errorCode: string | null;
    errors: string[] | null;
}
declare class EdgeApi {
    readonly options: EdgeApiOptions;
    constructor(options: EdgeApiOptions);
    /**
     * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#sample-request
     */
    getToken(): Promise<EdgeTokenDetails>;
    /**
     * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#uploading-a-package-to-update-an-existing-submission
     */
    uploadDraft(params: {
        token: EdgeTokenDetails;
        productId: string;
        zipFile: string;
    }): Promise<DraftResponse>;
    /**
     * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#checking-the-status-of-a-package-upload
     */
    uploadDraftOperation(params: {
        token: EdgeTokenDetails;
        productId: string;
        operationId: string;
    }): Promise<DraftOperation>;
    /**
     * Docs: https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/api/using-addons-api#publishing-the-submission
     */
    publish(params: {
        productId: string;
        token: EdgeTokenDetails;
    }): Promise<void>;
    private getAuthHeaders;
}

declare const EdgeAddonStoreOptions: z.ZodObject<{
    zip: z.ZodString;
    productId: z.ZodString;
    clientId: z.ZodString;
    skipSubmitReview: z.ZodDefault<z.ZodBoolean>;
    apiKey: z.ZodString;
    clientSecret: z.ZodOptional<z.ZodString>;
    accessTokenUrl: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
type EdgeAddonStoreOptions = z.infer<typeof EdgeAddonStoreOptions>;
declare class EdgeAddonStore implements Store {
    private readonly options;
    readonly setStatus: (text: string) => void;
    private api;
    constructor(options: EdgeAddonStoreOptions, setStatus: (text: string) => void);
    ensureZipsExist(): Promise<void>;
    submit(dryRun?: boolean | undefined): Promise<void>;
    private uploadAndPollValidation;
}

interface CwsApiOptions {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
}
interface CwsTokenDetails {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
    token_type: string;
}
declare class CwsApi {
    readonly options: CwsApiOptions;
    constructor(options: CwsApiOptions);
    private tokenEndpoint;
    private uploadEndpoint;
    private publishEndpoint;
    uploadZip(params: {
        extensionId: string;
        zipFile: string;
        token: CwsTokenDetails;
    }): Promise<void>;
    submitForReview(params: {
        extensionId: string;
        publishTarget: 'default' | 'trustedTesters';
        token: CwsTokenDetails;
        deployPercentage?: number;
        reviewExemption?: boolean;
    }): Promise<void>;
    getToken(): Promise<CwsTokenDetails>;
    private getAuthHeader;
}

declare const ChromeWebStoreOptions: z.ZodObject<{
    zip: z.ZodString;
    extensionId: z.ZodString;
    clientId: z.ZodString;
    clientSecret: z.ZodString;
    refreshToken: z.ZodString;
    publishTarget: z.ZodDefault<z.ZodEnum<{
        default: "default";
        trustedTesters: "trustedTesters";
    }>>;
    deployPercentage: z.ZodOptional<z.ZodInt>;
    reviewExemption: z.ZodDefault<z.ZodBoolean>;
    skipSubmitReview: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
type ChromeWebStoreOptions = z.infer<typeof ChromeWebStoreOptions>;
declare class ChromeWebStore implements Store {
    readonly options: ChromeWebStoreOptions;
    readonly setStatus: (text: string) => void;
    constructor(options: ChromeWebStoreOptions, setStatus: (text: string) => void);
    submit(dryRun?: boolean): Promise<void>;
    ensureZipsExist(): Promise<void>;
}

export { type AddonChannel, type AddonDetails, type AddonPagination, type AddonVersion, AddonsApi, type AddonsApiOptions, ChromeWebStore, ChromeWebStoreOptions, CwsApi, type CwsApiOptions, type CwsTokenDetails, type DraftOperation, type DraftResponse, EdgeAddonStore, EdgeAddonStoreOptions, EdgeApi, type EdgeApiOptions, type EdgeTokenDetails, FirefoxAddonStore, FirefoxAddonStoreOptions, InlineConfig, type SubmitResults, type UploadDetails, init, submit };
