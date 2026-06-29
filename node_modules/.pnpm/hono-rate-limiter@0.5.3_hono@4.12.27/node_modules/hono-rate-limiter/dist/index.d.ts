import { Env, Input, Context, Next, MiddlewareHandler } from 'hono';
import { HandlerResponse, Env as Env$1, Input as Input$1 } from 'hono/types';
import { StatusCode } from 'hono/utils/http-status';
import { WSContext, WSEvents } from 'hono/ws';

/**
 * Data returned from the `Store` when a client's hit counter is incremented.
 *
 * @property totalHits {number} - The number of hits for that client so far.
 * @property resetTime {Date | undefined} - The time when the counter resets.
 */
type ClientRateLimitInfo = {
    totalHits: number;
    resetTime?: Date;
};
/**
 * Promisify<T> is a utility type that represents a value of type T or a Promise<T>.
 * This type is useful for converting synchronous functions to asynchronous functions.
 * @example
 *   type getResult = Promisify<number>;  // getResult can be number or Promise<number>
 *   type getUser = Promisify<User>;      // getUser can be User or Promise<User>
 */
type Promisify<T> = T | Promise<T>;
/**
 * The rate limit related information for each client included in the
 * Hono context object.
 */
type RateLimitInfo = {
    limit: number;
    used: number;
    remaining: number;
    resetTime: Date | undefined;
};
/**
 * Hono request handler that sends back a response when a client is
 * rate-limited.
 *
 * @param context {Context} - The Hono context object.
 * @param next {Next} - The Hono `next` function, can be called to skip responding.
 * @param optionsUsed {ConfigType} - The options used to set up the middleware.
 */
type RateLimitExceededEventHandler<E extends Env = Env, P extends string = string, I extends Input = Input> = (c: Context<E, P, I>, next: Next, optionsUsed: ConfigType<E, P, I>) => void;
type KeyGeneratorType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * Method to generate custom identifiers for clients.
     */
    keyGenerator: (c: Context<E, P, I>) => Promisify<string>;
};
type CommonConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * The response body to send back when a client is rate limited.
     *
     * Defaults to `'Too many requests, please try again later.'`
     */
    message: string | Record<string, unknown> | ((c: Context<E, P, I>) => Promisify<string | Record<string, unknown>>);
    /**
     * The HTTP status code to send back when a client is rate limited.
     *
     * Defaults to `HTTP 429 Too Many Requests` (RFC 6585).
     */
    statusCode: StatusCode;
    /**
     * Hono request handler that sends back a response when a client is
     * rate-limited.
     *
     * By default, sends back the `statusCode` and `message` set via the options.
     */
    handler: RateLimitExceededEventHandler<E, P, I>;
    /**
     * Method (in the form of middleware) to determine whether or not this request
     * counts towards a client's quota.
     *
     * By default, skips no requests.
     */
    skip: (c: Context<E, P, I>) => Promisify<boolean>;
};
type RateLimit = {
    limit: (options: {
        key: string;
    }) => Promisify<{
        success: boolean;
    }>;
};
type CloudflareConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * The Cloudflare rate limit binding to use.
     */
    binding: RateLimit | ((c: Context<E, P, I>) => RateLimit);
} & KeyGeneratorType<E, P, I> & CommonConfigType<E, P, I>;
type CloudflareConfigProps<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * The Cloudflare rate limit binding to use.
     */
    binding: RateLimit | ((c: Context<E, P, I>) => RateLimit);
} & KeyGeneratorType<E, P, I> & Partial<CommonConfigType<E, P, I>>;
type HonoConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * How long we should remember the requests.
     *
     * Defaults to `60000` ms (= 1 minute).
     */
    windowMs: number;
    /**
     * The maximum number of connections to allow during the `window` before
     * rate limiting the client.
     *
     * Can be the limit itself as a number or express middleware that parses
     * the request and then figures out the limit.
     *
     * Defaults to `5`.
     */
    limit: number | ((c: Context<E, P, I>) => Promisify<number>);
    /**
     * Whether to enable support for the standardized rate limit headers (`RateLimit-*`).
     *
     * Defaults to `draft-6`.
     */
    standardHeaders: boolean | "draft-6" | "draft-7";
    /**
     * The name of the property on the context object to store the rate limit info.
     *
     * Defaults to `rateLimit`.
     */
    requestPropertyName: string;
    /**
     * The name of the property on the context object to store the Data Store instance.
     *
     * Defaults to `rateLimitStore`.
     */
    requestStorePropertyName: string;
    /**
     * If `true`, the library will (by default) skip all requests that have a 4XX
     * or 5XX status.
     *
     * Defaults to `false`.
     */
    skipFailedRequests: boolean;
    /**
     * If `true`, the library will (by default) skip all requests that have a
     * status code less than 400.
     *
     * Defaults to `false`.
     */
    skipSuccessfulRequests: boolean;
    /**
     * Method to determine whether or not the request counts as 'succesful'. Used
     * when either `skipSuccessfulRequests` or `skipFailedRequests` is set to true.
     *
     * By default, requests with a response status code less than 400 are considered
     * successful.
     */
    requestWasSuccessful: (c: Context<E, P, I>) => Promisify<boolean>;
    /**
     * The `Store` to use to store the hit count for each client.
     *
     * By default, the built-in `MemoryStore` will be used.
     */
    store: Store<E, P, I>;
} & KeyGeneratorType<E, P, I> & CommonConfigType<E, P, I>;
type HonoConfigProps<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    binding?: never;
} & KeyGeneratorType<E, P, I> & Partial<HonoConfigType<E, P, I>>;
type ConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> = HonoConfigType<E, P, I> | CloudflareConfigType<E, P, I>;
type ConfigProps<E extends Env = Env, P extends string = string, I extends Input = Input> = HonoConfigProps<E, P, I> | CloudflareConfigProps<E, P, I>;
type WSStatusCode = 1000 | 1001 | 1002 | 1003 | 1004 | 1005 | 1006 | 1007 | 1008 | 1009 | 1010;
/**
 * Hono request handler that sends back a response when a client is
 * rate-limited.
 *
 * @param context {Context} - The Hono context object.
 * @param next {Next} - The Hono `next` function, can be called to skip responding.
 * @param optionsUsed {ConfigType} - The options used to set up the middleware.
 */
type WSRateLimitExceededEventHandler<E extends Env = Env, P extends string = string, I extends Input = Input> = (event: unknown, ws: WSContext, optionsUsed: WSConfigType<E, P, I>) => void;
/**
 * The configuration options for the rate limiter.
 */
interface WSConfigType<E extends Env = Env, P extends string = string, I extends Input = Input> extends Omit<HonoConfigType<E, P, I>, "statusCode" | "standardHeaders" | "requestWasSuccessful" | "handler" | "skip"> {
    /**
     * The response body to send back when a client is rate limited.
     *
     * Defaults to `'Too many requests, please try again later.'`
     */
    message: string;
    /**
     * The ws status code to send back when a client is rate limited.
     *
     * Defaults to `HTTP 1008 Terminating The Connection` (RFC 6455).
     */
    statusCode: WSStatusCode;
    /**
     * Hono ws request handler that sends back a response when a client is
     * rate-limited.
     *
     * By default, sends back the `statusCode` and `message` set via the options.
     */
    handler: WSRateLimitExceededEventHandler<E, P, I>;
    /**
     * Method (in the form of middleware) to determine whether or not this ws request
     * counts towards a client's quota.
     *
     * By default, skips no requests.
     */
    skip: (event: unknown, ws: WSContext) => Promisify<boolean>;
}
type WSConfigProps<E extends Env = Env, P extends string = string, I extends Input = Input> = KeyGeneratorType<E, P, I> & Partial<WSConfigType<E, P, I>>;
/**
 * An interface that all hit counter stores must implement.
 */
type Store<E extends Env = Env, P extends string = string, I extends Input = Input> = {
    /**
     * Method that initializes the store, and has access to the options passed to
     * the middleware too.
     *
     * @param options {HonoConfigType} - The options used to setup the middleware.
     */
    init?: (options: HonoConfigType<E, P, I>) => void;
    /**
     * Method to fetch a client's hit count and reset time.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
     */
    get?: (key: string) => Promisify<ClientRateLimitInfo | undefined>;
    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
     */
    increment: (key: string) => Promisify<ClientRateLimitInfo>;
    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     */
    decrement: (key: string) => Promisify<void>;
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     */
    resetKey: (key: string) => Promisify<void>;
    /**
     * Method to reset everyone's hit counter.
     */
    resetAll?: () => Promisify<void>;
    /**
     * Method to shutdown the store, stop timers, and release all resources.
     */
    shutdown?: () => Promisify<void>;
    /**
     * Flag to indicate that keys incremented in one instance of this store can
     * not affect other instances. Typically false if a database is used, true for
     * MemoryStore.
     *
     * Used to help detect double-counting misconfigurations.
     */
    localKeys?: boolean;
    /**
     * Optional value that the store prepends to keys
     *
     * Used by the double-count check to avoid false-positives when a key is counted twice, but with different prefixes
     */
    prefix?: string;
};

/**
 *
 * Create an instance of rate-limiting middleware for Hono.
 *
 * @param config {ConfigProps} - Options to configure the rate limiter.
 *
 * @returns - The middleware that rate-limits clients based on your configuration.
 *
 * @public
 */
declare function rateLimiter<E extends Env = Env, P extends string = string, I extends Input = Input, R extends HandlerResponse<any> = Response>(config: ConfigProps<E, P, I>): MiddlewareHandler<E, P, I, R>;

/**
 * A `Store` that stores the hit count for each client in memory.
 */
declare class MemoryStore<E extends Env$1 = Env$1, P extends string = string, I extends Input$1 = Input$1> implements Store<E, P, I> {
    #private;
    /**
     * These two maps store usage (requests) and reset time by key (for example, IP
     * addresses or API keys).
     *
     * They are split into two to avoid having to iterate through the entire set to
     * determine which ones need reset. Instead, `Client`s are moved from `previous`
     * to `current` as they hit the endpoint. Once `windowMs` has elapsed, all clients
     * left in `previous`, i.e., those that have not made any recent requests, are
     * known to be expired and can be deleted in bulk.
     */
    previous: Map<string, Required<ClientRateLimitInfo>>;
    current: Map<string, Required<ClientRateLimitInfo>>;
    /**
     * A reference to the active timer.
     */
    interval?: any;
    /**
     * Method that initializes the store.
     *
     * @param options {HonoConfigType | WSConfigType} - The options used to setup the middleware.
     */
    init(options: HonoConfigType<E, P, I> | WSConfigType<E, P, I>): void;
    /**
     * Method to fetch a client's hit count and reset time.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
     *
     * @public
     */
    get(key: string): ClientRateLimitInfo | undefined;
    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client.
     *
     * @public
     */
    increment(key: string): ClientRateLimitInfo;
    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     *
     * @public
     */
    decrement(key: string): void;
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client.
     *
     * @public
     */
    resetKey(key: string): void;
    /**
     * Method to reset everyone's hit counter.
     *
     * @public
     */
    resetAll(): void;
    /**
     * Method to stop the timer (if currently running) and prevent any memory
     * leaks.
     *
     * @public
     */
    shutdown(): void;
    /**
     * Recycles a client by setting its hit count to zero, and reset time to
     * `windowMs` milliseconds from now.
     *
     * NOT to be confused with `#resetKey()`, which removes a client from both the
     * `current` and `previous` maps.
     *
     * @param client {Client} - The client to recycle.
     * @param now {number} - The current time, to which the `windowMs` is added to get the `resetTime` for the client.
     *
     * @return {Client} - The modified client that was passed in, to allow for chaining.
     */
    private resetClient;
    /**
     * Retrieves or creates a client, given a key. Also ensures that the client being
     * returned is in the `current` map.
     *
     * @param key {string} - The key under which the client is (or is to be) stored.
     *
     * @returns {Client} - The requested client.
     */
    private getClient;
    /**
     * Move current clients to previous, create a new map for current.
     *
     * This function is called every `windowMs`.
     */
    private clearExpired;
}

type RedisClient = {
    scriptLoad: (script: string) => Promise<string>;
    evalsha: <TArgs extends unknown[], TData = unknown>(sha1: string, keys: string[], args: TArgs) => Promise<TData>;
    decr: (key: string) => Promise<number>;
    del: (key: string) => Promise<number>;
};
/**
 * The type of data Redis might return to us.
 */
type Data = boolean | number | string;
type RedisReply = Data | Data[];
/**
 * The configuration options for the store.
 */
type Options = {
    /**
     * The Redis client
     */
    client: RedisClient;
    /**
     * The text to prepend to the key in Redis.
     */
    readonly prefix?: string;
    /**
     * Whether to reset the expiry for a particular key whenever its hit count
     * changes.
     */
    readonly resetExpiryOnChange?: boolean;
};

declare class RedisStore<E extends Env$1 = Env$1, P extends string = string, I extends Input$1 = Input$1> implements Store<E, P, I> {
    /**
     * The text to prepend to the key in Redis.
     */
    prefix: string;
    /**
     * Whether to reset the expiry for a particular key whenever its hit count
     * changes.
     */
    resetExpiryOnChange: boolean;
    /**
     * The Redis client to use.
     */
    client: RedisClient;
    /**
     * The number of milliseconds to remember that user's requests.
     */
    windowMs: number;
    /**
     * Stores the loaded SHA1s of the LUA scripts used for executing the increment
     * and get key operations.
     */
    incrementScriptSha: Promise<string>;
    getScriptSha: Promise<string>;
    /**
     * @constructor for `RedisStore`.
     *
     * @param options {Options} - The configuration options for the store.
     */
    constructor(options: Options);
    /**
     * Loads the script used to increment a client's hit count.
     */
    loadIncrementScript(): Promise<string>;
    /**
     * Loads the script used to fetch a client's hit count and expiry time.
     */
    loadGetScript(): Promise<string>;
    /**
     * Runs the increment command, and retries it if the script is not loaded.
     */
    retryableIncrement(key: string): Promise<RedisReply>;
    /**
     * Method to prefix the keys with the given text.
     *
     * @param key {string} - The key.
     *
     * @returns {string} - The text + the key.
     */
    prefixKey(key: string): string;
    /**
     * Method that actually initializes the store.
     *
     * @param options {RateLimitConfiguration} - The options used to setup the middleware.
     */
    init(options: HonoConfigType<E, P, I>): void;
    /**
     * Method to fetch a client's hit count and reset time.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
     */
    get(key: string): Promise<ClientRateLimitInfo | undefined>;
    /**
     * Method to increment a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     *
     * @returns {ClientRateLimitInfo} - The number of hits and reset time for that client
     */
    increment(key: string): Promise<ClientRateLimitInfo>;
    /**
     * Method to decrement a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    decrement(key: string): Promise<void>;
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    resetKey(key: string): Promise<void>;
}

type UnstorageInstance = {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<void>;
    remove: (key: string) => Promise<void>;
};
/**
 * A `Store` that stores the hit count for each client using Unstorage
 *
 * {@link https://unstorage.unjs.io/}
 */
declare class UnstorageStore<E extends Env$1 = Env$1, P extends string = string, I extends Input$1 = Input$1> implements Store<E, P, I> {
    /**
     * The duration of time before which all hit counts are reset (in milliseconds).
     */
    windowMs: number;
    /**
     * The text to prepend to the key in Unstorage.
     */
    prefix: string;
    /**
     * The unstorage storage instance.
     */
    storage: UnstorageInstance;
    /**
     * @constructor for `UnstorageStore`.
     *
     * @param options {Options} - The configuration options for the store.
     */
    constructor(options: {
        storage: UnstorageInstance;
        prefix?: string;
    });
    /**
     * Method to prefix the keys with the given text.
     *
     * @param key {string} - The key.
     *
     * @returns {string} - The text + the key.
     */
    prefixKey(key: string): string;
    /**
     * Method that actually initializes the store.
     *
     * @param options {HonoConfigType} - The options used to setup the middleware.
     */
    init(options: HonoConfigType<E, P, I>): void;
    /**
     * Method to fetch a client's hit count and reset time.
     *
     * @param key {string} - The identifier for a client.
     *
     * @returns {ClientRateLimitInfo | undefined} - The number of hits and reset time for that client.
     */
    get(key: string): Promise<ClientRateLimitInfo | undefined>;
    /**
     * Method to increment a client's hit counter. If the current time is within an active window,
     * it increments the existing hit count. Otherwise, it starts a new window with a hit count of 1.
     *
     * @param key {string} - The identifier for a client
     *
     * @returns {ClientRateLimitInfo} - An object containing:
     *   - totalHits: The updated number of hits for the client
     *   - resetTime: The time when the current rate limit window expires
     */
    increment(key: string): Promise<ClientRateLimitInfo>;
    /**
     * Method to decrement a client's hit counter. Only decrements if there is an active time window.
     * The hit counter will never go below 0.
     *
     * @param key {string} - The identifier for a client
     * @returns {Promise<void>} - Returns void after attempting to decrement the counter
     */
    decrement(key: string): Promise<void>;
    /**
     * Method to reset a client's hit counter.
     *
     * @param key {string} - The identifier for a client
     */
    resetKey(key: string): Promise<void>;
    /**
     * Method to update a record.
     *
     * @param key {string} - The identifier for a client.
     * @param payload {ClientRateLimitInfo} - The payload to update.
     */
    private updateRecord;
}

/**
 *
 * Create an instance of ws based rate-limiting middleware for Hono.
 *
 * @param config {WSConfigProps} - Options to configure the rate limiter.
 *
 * @returns - The middleware that rate-limits clients based on your configuration.
 *
 * @public
 */
declare function webSocketLimiter<E extends Env = Env, P extends string = string, I extends Input = Input>(config: WSConfigProps<E, P, I>): (createEvents: (c: Context<E, P, I>) => WSEvents | Promise<WSEvents>) => (c: Context<E, P, I>) => Promise<WSEvents>;

export { MemoryStore, RedisStore, UnstorageStore, rateLimiter, webSocketLimiter };
export type { ClientRateLimitInfo, CloudflareConfigProps, CloudflareConfigType, ConfigProps, ConfigType, HonoConfigProps, HonoConfigType, Options, Promisify, RateLimitExceededEventHandler, RateLimitInfo, RedisClient, RedisReply, Store, UnstorageInstance, WSConfigProps, WSConfigType, WSRateLimitExceededEventHandler, WSStatusCode };
