/**
 * Class for parsing and performing operations on match patterns.
 *
 * @example
 * const pattern = new MatchPattern("*://google.com/*");
 *
 * pattern.includes("https://google.com");            // true
 * pattern.includes("http://youtube.com/watch?v=123") // false
 */
declare class MatchPattern {
    static PROTOCOLS: string[];
    private protocolMatches;
    private hostnameMatch;
    private pathnameMatch;
    private isAllUrls?;
    /**
     * Parse a match pattern string. If it is invalid, the constructor will throw an
     * `InvalidMatchPattern` error.
     *
     * @param matchPattern The match pattern to parse.
     */
    constructor(matchPattern: string);
    /**
     * Check if a URL is included in a pattern.
     */
    includes(url: string | URL | Location): boolean;
    private isHttpMatch;
    private isHttpsMatch;
    private isHostPathMatch;
    private isFileMatch;
    private isFtpMatch;
    private isUrnMatch;
    private convertPatternToRegex;
    private escapeForRegex;
}
declare class InvalidMatchPattern extends Error {
    constructor(matchPattern: string, reason: string);
}

export { InvalidMatchPattern, MatchPattern };
