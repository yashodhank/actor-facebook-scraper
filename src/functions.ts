import Apify from 'apify';
import type { ElementHandle, Page } from 'puppeteer';
import { InfoError } from './error';
import { CSS_SELECTORS, MOBILE_HOST, DESKTOP_HOST } from './constants';
import type { FbLocalBusiness, FbFT, FbSection, FbLabel, FbReview } from './definitions';

import UserAgents = require('user-agents');

const { log, sleep } = Apify.utils;

/**
 * Takes a story.php and turns into a cleaned desktop permalink.php
 */
export const storyFbToDesktopPermalink = (url?: string | null) => {
    if (!url) {
        return null;
    }

    const parsed = new URL(url);
    parsed.hostname = DESKTOP_HOST;
    if (url.includes('story_fbid=')
        && url.includes('id=')
        && !url.includes('/photos')) {
        parsed.pathname = '/permalink.php';
    }
    parsed.searchParams.forEach((_, key) => {
        if (!['story_fbid', 'id', 'substory_index', 'type'].includes(key)) {
            parsed.searchParams.delete(key);
        }
    });

    return parsed;
};

/**
 * Convert date types to milliseconds.
 * Supports years '2020', '2010-10-10', 1577836800000, 1577836800, '2020-01-01T00:00:00.000Z'
 */
export function convertDate(value: string | number | Date | undefined, isoString: true): string;
export function convertDate(value?: string | number | Date): number;
export function convertDate(value?: string | number | Date, isoString = false) {
    if (!value) {
        return Infinity;
    }

    if (value instanceof Date) {
        return isoString ? value.toISOString() : value.getTime();
    }

    let tryConvert = new Date(value);

    // catch values less than year 2002
    if (Number.isNaN(tryConvert.getTime()) || `${tryConvert.getTime()}`.length < 13) {
        if (typeof value === 'string') {
            // convert seconds to miliseconds
            tryConvert = new Date(value.length >= 13 ? +value : +value * 1000);
        } else if (typeof value === 'number') {
            // convert seconds to miliseconds
            tryConvert = new Date(`${value}`.length >= 13 ? value : value * 1000);
        }
    }

    return isoString ? tryConvert.toISOString() : tryConvert.getTime();
}

/**
 * Check if the provided date is greater than the minimum
 */
export const cutOffDate = (base?: string | number) => {
    let d = convertDate(base);

    if (!Number.isFinite(d)) {
        d *= -1;
    }

    return (compare: Date | string | number) => {
        return convertDate(compare) >= d;
    };
};

/**
 * Resolves a promise from the outside
 */
export const deferred = () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    let resolve: () => any = () => {};
    const promise = new Promise((r) => {
        resolve = r;
    });
    return { promise, resolve };
};

/**
 * Simple stopwatch to measure long running interactions in milliseconds
 */
export const stopwatch = () => {
    const start = Date.now();

    return () => Date.now() - start;
};

/**
 * Execute the callback if the current log level is DEBUG, no-op
 * if not. Removes the need of checking inline
 */
export const executeOnDebug = async (cb: () => Promise<void>) => {
    if (cb && log.getLevel() === log.LEVELS.DEBUG) {
        await cb();
    }
};

/**
 * Return new user agents from initializer. Filter some vendors out to make the output predictable
 */
const initializeUserAgents = () => {
    type UA = { userAgent: string; viewportHeight: number; viewportWidth: number };

    const mobileUserAgents = new UserAgents(({ userAgent, viewportHeight, viewportWidth }: UA) => {
        return (
            viewportHeight >= 640
            && viewportWidth >= 360
            && /^Mozilla/.test(userAgent)
            && /(Pixel|SG-|ONE)/.test(userAgent) // galaxy / pixel / oneplus
            && /(Android [7891])/.test(userAgent)
            && !/(Firefox|SM-|YAL)/.test(userAgent)
            && /\d$/.test(userAgent)
            && userAgent.length <= 140
        );
    });

    const desktopUserAgents = new UserAgents(({ userAgent, viewportHeight, viewportWidth }: UA) => {
        return (
            viewportHeight >= 600
            && viewportWidth >= 800
            && /^Mozilla/.test(userAgent)
            && !/Firefox/.test(userAgent)
            && /\d$/.test(userAgent)
            && /(X11|Win64|Intel Mac OS X)/.test(userAgent)
            && userAgent.length <= 120
        );
    });

    return {
        desktop: () => desktopUserAgents.random(),
        mobile: () => mobileUserAgents.random(),
    };
};

export const userAgents = initializeUserAgents();

/**
 * Remove duplicates from array while filtering falsy values
 */
export const uniqueNonEmptyArray = <T extends any[]>(value: T) => [...new Set(value)].filter(s => s);

/**
 * A helper function to evaluate the same callback in an ElementHandle
 * array, in parallel
 */
export const evaluateFilterMap = async <E extends Element, C extends (el: E) => Promise<any>>(els: ElementHandle<E>[], map: C) => {
    type MapReturn = NonNullable<C extends (...args: any) => PromiseLike<infer R> ? R : any>;

    const values: MapReturn[] = [];

    for (const el of els) {
        try {
            const result = await el.evaluate(map);

            if (result !== undefined && result !== null) {
                values.push(result as MapReturn);
            }
        } catch (e) {
            // suppress errors, show them on debug
            log.debug(e.message, { values });
        }
    }

    return values;
};

/**
 * Puppeteer $$ wrapper that gives some context and info
 * if the selector is missing
 */
export const createPageSelector = <E extends Element, C extends (els: ElementHandle<E>[], page: Page) => Promise<any>>(selector: string, namespace: string, map: C) => {
    type MapReturn = C extends (...args: any) => Promise<infer R> ? R : any;

    return async (page: Page, wait = 0): Promise<MapReturn> => {
        if (!await page.$(selector)) {
            if (wait > 0) {
                try {
                    await page.waitForSelector(selector, { timeout: wait });
                } catch (e) {
                    if (e.name !== 'TimeoutError') {
                        // a non timeout error means something else, we need
                        // to rethrow. a TimeoutError is expected
                        throw e;
                    }
                }

                throw new InfoError(`${namespace} page selector not found`, {
                    namespace,
                    selector,
                    url: page.url(),
                });
            }
        }

        return map(await page.$$(selector), page); // never fails, returns [] when not found
    };
};

/**
 * Find a field by image and get it's adjacent div text
 */
export const createSelectorFromImageSrc = (names: string[]) => {
    const selectors = names.map(name => `img[src*="${name}.png"]`).join(',');

    return async (page: Page) => {
        try {
            const content = await page.$$eval(selectors, async (els) => {
                return els.map((el) => {
                    const closest = el.closest('div[id]');

                    if (!closest) {
                        return '';
                    }

                    const textDiv = closest.querySelector<HTMLDivElement>(':scope > div');

                    if (!textDiv) {
                        return '';
                    }

                    window.unhideChildren(textDiv);

                    return `${textDiv.innerText || ''}`.trim();
                }).filter(s => s);
            });

            if (!content.length) {
                throw new InfoError('Empty content', {
                    namespace: 'createSelectorFromImageSrc',
                    selector: selectors,
                    url: page.url(),
                });
            }

            return content;
        } catch (e) {
            if (e instanceof InfoError) {
                throw e;
            }

            await executeOnDebug(async () => {
                await Apify.setValue(`image-selector--${names.join('~')}--${Math.random()}`, await page.content(), { contentType: 'text/html' });
            });

            throw new InfoError('Image selector not found', {
                namespace: 'createSelectorFromImageSrc',
                selector: selectors,
                url: page.url(),
            });
        }
    };
};

/**
 * Text selectors that uses image names as a starting point
 */
export const imageSelectors = {
    checkins: createSelectorFromImageSrc(['a0b87sO1_bq']),
    website: createSelectorFromImageSrc(['TcXGKbk-rV1', 'xVA3lB-GVep', 'EaDvTjOwxIV', 'aE7VLFYMYdl']),
    categories: createSelectorFromImageSrc(['Knsy-moHXi6', 'LwDWwC1d0Rx', '3OfQvJdYD_W']),
    email: createSelectorFromImageSrc(['C1eWXyukMez', 'vKDzW_MdhyP']),
    info: createSelectorFromImageSrc(['u_owK2Sz5n6', 'fTt3W6Nw8z-']), // about / founded
    impressum: createSelectorFromImageSrc(['7Pg05R2u_QQ']),
    instagram: createSelectorFromImageSrc(['EZj5-1P4vhh']),
    twitter: createSelectorFromImageSrc(['IP-E0-f5J0m']),
    youtube: createSelectorFromImageSrc(['MyCpzAb80U1']),
    overview: createSelectorFromImageSrc(['uAsvCr33XaU']),
    awards: createSelectorFromImageSrc(['rzXNHRgEfui']),
    mission: createSelectorFromImageSrc(['z-wfU5xgk6Z']),
    address: createSelectorFromImageSrc(['h2e1qHNjIzG']),
    phone: createSelectorFromImageSrc(['6oGknb-0EsE', 'znYEAkatLCe']),
    priceRange: createSelectorFromImageSrc(['q-WY9vrfkFZ']),
    products: createSelectorFromImageSrc(['bBMZ-3vnEih']),
    transit: createSelectorFromImageSrc(['uQHLMTQ0fUS']),
    payment: createSelectorFromImageSrc(['Dx9c291MaDt']),
};

/**
 * General page selectors
 */
export const pageSelectors = {
    // eslint-disable-next-line max-len
    verified: createPageSelector('#msite-pages-header-contents > div:not([class]):not([id]) > div:not([class]):not([id])', 'mobilePageHeader', async (els) => {
        if (!els.length) {
            return false;
        }

        return !!(await els[0].$(CSS_SELECTORS.VERIFIED));
    }),
    messenger: createPageSelector('a[href^="https://m.me"]', 'messenger', async (els) => {
        if (!els.length) {
            return '';
        }

        return els[0].evaluate(async (el) => (el as HTMLLinkElement).href);
    }),
    // returns LD+JSON page information
    ld: createPageSelector(CSS_SELECTORS.LDJSON, 'ld', async (els) => {
        if (!els.length) {
            return [] as FbLocalBusiness[];
        }

        return evaluateFilterMap(els, async (el) => {
            const jsonContent = el.innerHTML;

            if (!jsonContent) {
                return;
            }

            return JSON.parse(jsonContent) as FbLocalBusiness;
        });
    }),
    // get metadata from posts
    posts: createPageSelector('abbr', 'posts', async (els) => {
        return evaluateFilterMap(els, async (el) => {
            const article = el.closest<HTMLDivElement>('article');

            if (article) {
                const { ft } = article.dataset;

                if (!ft) {
                    return;
                }

                try {
                    return {
                        ft: JSON.parse(ft) as FbFT,
                        url: el.closest<HTMLAnchorElement>('a[href]')?.href || '',
                    };
                } catch (e) {} // eslint-disable-line
            }
        });
    }),
    // get the review average
    reviewAverage: createPageSelector('[style*="background-color: #4267B2;"]', 'reviewAverage', async (els) => {
        if (!els.length) {
            return 0;
        }

        return els[0].evaluate(async (el) => {
            const parent = el.closest<HTMLDivElement>('[style="padding: 0 0 0 0"]');

            if (!parent || !parent.innerText) {
                return 0;
            }

            window.unhideChildren(parent);

            return (parent.innerText ? +parent.innerText.replace(/,/g, '.') : 0) || 0;
        });
    }),
    reviews: createPageSelector('abbr[data-store]', 'reviews', async (els): Promise<FbReview[]> => {
        if (!els.length) {
            return [];
        }

        return (await evaluateFilterMap(els, async (el) => {
            const { store } = (el as HTMLSpanElement).dataset;

            if (!store) {
                return null;
            }

            const parse: { time: number } = JSON.parse(store);

            if (!parse || !parse.time) {
                return null;
            }

            const container = el.closest<HTMLDivElement>('div:not([id]):not([class]) > [data-ntid]');

            container?.querySelectorAll('.text_exposed_hide').forEach(te => te.remove()); // emulate "see more"

            window.unhideChildren(container);

            const joinInnerText = (selector: string) => [...(container?.querySelectorAll<HTMLDivElement>(selector) ?? [])].map((s) => {
                window.unhideChildren(s);
                return s.innerText;
            });

            const title = joinInnerText('[data-nt="FB:TEXT4"]').join('\n') || null;
            const text = joinInnerText('[data-gt]').join('\n') || null;
            const attributes = joinInnerText('[data-nt="FB:EXPANDABLE_TEXT"]').map((s) => s.split('・')).flat();
            const url = container?.querySelector<HTMLAnchorElement>('a[aria-label]')?.href ?? null;

            return {
                title,
                text,
                attributes,
                url,
                date: parse.time,
            };
        })).map((s): FbReview => ({ ...s, canonical: null, date: convertDate(s.date, true) }));
    }),
    latLng: createPageSelector('[style*="static_map.php"]', 'latLng', async (els) => {
        if (!els.length) {
            return { lat: null, lng: null };
        }

        return els[0].evaluate(async (el) => {
            const matches = (el as HTMLImageElement).style.backgroundImage.match(/marker_list%5B0%5D=([^%]+)%2C([^&]+)&/);

            if (!matches || !matches[1] || !matches[2]) {
                return {
                    lat: null,
                    lng: null,
                };
            }

            return {
                lat: +matches[1] || null,
                lng: +matches[2] || null,
            };
        });
    }),
};

/**
 * Takes any Facebook URL and create a page mobile version of it.
 *
 * Forcing /pg/ makes it easy to ensure that the url being accessed is
 * actually a page, as it errors in personal profiles.
 *
 * @throws {TypeError} Throws with malformed urls
 * @param filterParams
 *  Setting to true for removing everything. Using an array of strings acts like a
 *  whitelist, contains parameters that should not be deleted.
 */
export const normalizeToMobilePageUrl = (url: string, filterParams: string[] | boolean = false): string => {
    const parsedUrl = new URL(url);

    if (!parsedUrl.pathname.startsWith('/pg')) {
        parsedUrl.pathname = `/pg/${parsedUrl.pathname.split(/\//g).filter(s => s).join('/')}`;
    }

    if (parsedUrl.hostname !== MOBILE_HOST) {
        parsedUrl.hostname = MOBILE_HOST;
    }

    parsedUrl.searchParams.forEach((_, key) => {
        // query parameters, like refsrc, ref
        if (Array.isArray(filterParams) && filterParams.includes(key)) {
            return;
        }

        if (!filterParams) {
            return;
        }

        parsedUrl.searchParams.delete(key);
    });

    return parsedUrl.toString();
};

/**
 * Take any URL and make a properly formed page url.
 */
export const normalizeOutputPageUrl = (url: string) => {
    const parsedUrl = new URL(url);

    parsedUrl.protocol = 'https:';
    parsedUrl.hostname = DESKTOP_HOST;
    parsedUrl.searchParams.forEach((_, key) => {
        // delete all query strings, like refsrc, ref
        parsedUrl.searchParams.delete(key);
    });
    parsedUrl.pathname = parsedUrl.pathname.replace('/pg/', '');

    return parsedUrl.toString();
};

/**
 * Sets the cookie on the page to the selected locale
 */
export const setLanguageCodeToCookie = async (language: string, page: Page) => {
    await page.setCookie({
        domain: '.facebook.com',
        secure: true,
        name: 'locale',
        path: '/',
        value: language.replace('-', '_'),
    });
};

/**
 * Detect the type of url start
 *
 * @throws {InfoError}
 */
export const getUrlLabel = (url: string): FbLabel => {
    if (!url) {
        throw new InfoError('Invalid url provided', {
            url,
            namespace: 'getUrlLabel',
        });
    }

    const parsedUrl = new URL(url);

    // works with m.facebook.com, lang-country.facebook.com, www.latest.facebook.com
    if (parsedUrl.hostname.includes('facebook.com')) {
        if (parsedUrl.pathname.startsWith('/biz/')) {
            return 'LISTING';
        }

        if (/\/posts\/\d+/.test(parsedUrl.pathname)) {
            return 'POST';
        }

        if (/\/(pg)?\/?[a-z0-9.-]+\/?/i.test(parsedUrl.pathname)) {
            return 'PAGE';
        }
    }

    throw new InfoError('Invalid Facebook url provided or could not be determined', {
        url,
        namespace: 'getUrlLabel',
    });
};

/**
 * Generates subsection urls from the main page url
 */
export const generateSubpagesFromUrl = (
    url: string,
    pages: FbSection[] = ['posts', 'about', 'reviews', 'services'],
) => {
    const base = normalizeToMobilePageUrl(url, true)
        .split('/', 5) // we are interested in https://m.facebook.com/pg/pagename
        .join('/');

    const urls: Array<{ url: string; section: FbSection }> = [{ url: base, section: 'home' }];

    return urls.concat(pages.map(sub => ({
        url: `${base}/${sub}`,
        section: sub,
    })));
};

/**
 * Extract the Facebook page name from the url, which are unique
 *
 * @throws {InfoError}
 */
export const extractUsernameFromUrl = (url: string) => {
    if (!url) {
        throw new InfoError('Empty url', {
            url,
            namespace: 'extractUsernameFromUrl',
        });
    }

    const matches = url.match(/facebook.com(?:\/pg)?\/([^/]+)/);

    if (!matches || !matches[1]) {
        throw new InfoError('Couldn\'t match username in url', {
            url,
            namespace: 'extractUsernameFromUrl',
        });
    }

    return matches[1];
};

export interface ScrollUntilOptions {
    selectors?: string[];
    /**
     * Returning true means stop
     */
    maybeStop?: (param: {
        count: number;
        scrollChanged: boolean;
        bodyChanged: boolean;
        scrollSize: number;
        heightSize: number;
    }) => Promise<boolean>;
    sleepMillis: number;
    doScroll?: () => boolean;
}

/**
 * Scrolls until find a selector or stop from the outside
 */
export const scrollUntil = async (page: Page, { doScroll = () => true, sleepMillis, selectors = [], maybeStop }: ScrollUntilOptions) => {
    const scrolls = new Set<number>();
    const heights = new Set<number>();
    let count = 0;
    const url = page.url();

    const isChanging = (histogram: Set<number>, num: number) => {
        if (num === undefined || num === null) {
            return false;
        }

        return [...histogram].every(val => (num > val));
    };

    const shouldContinue = async ({ scrollChanged, bodyChanged }: {
            scrollChanged: boolean;
            bodyChanged: boolean;
        }) => {
        if (selectors.length) {
            const foundSelectors = await page.evaluate(async (sels: string[]) => {
                return sels.some((z) => {
                    return [...document.querySelectorAll(z)].some(el => (window.innerHeight - el.getBoundingClientRect().top > 0));
                });
            }, selectors);

            if (foundSelectors) {
                // found a selector
                log.debug('Found selectors', { selectors, url });

                return false;
            }
        }

        if (maybeStop && await maybeStop({
            count,
            scrollChanged,
            bodyChanged,
            heightSize: heights.size,
            scrollSize: scrolls.size,
        })) {
            // stop from the outside
            return false;
        }

        return true;
    };

    log.debug('Scrolling page', {
        url,
        selectors,
    });

    // eslint-disable-next-line no-constant-condition
    while (true) {
        await sleep(sleepMillis);

        if (doScroll()) {
            await sleep(sleepMillis);

            await page.evaluate(async () => {
                window.scrollBy({
                    top: Math.round(window.innerHeight / 1.75) || 100,
                });
            });

            await sleep(sleepMillis);

            const lastScroll = await page.evaluate(async () => window.scrollY);
            const scrollChanged = isChanging(scrolls, lastScroll);

            if (lastScroll) {
                scrolls.add(lastScroll);
            }

            const bodyHeight = await page.evaluate(async () => document.body.scrollHeight);
            const bodyChanged = isChanging(heights, bodyHeight);

            if (bodyHeight) {
                heights.add(bodyHeight);
            }

            log.debug('Scroll data', {
                url,
                scrollChanged,
                lastScroll,
                scrolls: [...scrolls],
                bodyChanged,
                bodyHeight,
                heights: [...heights],
                count,
            });

            // wait more and more for each expected length
            await sleep(sleepMillis);

            if (!await shouldContinue({ scrollChanged, bodyChanged })) {
                break;
            }


            count++;
        }
    }

    log.debug('Stopped scrolling', { url });
};

/**
 * Click "See More" independently of language
 */
export const clickSeeMore = async (page: Page) => {
    let clicks = 0;

    for (const seeMore of await page.$$(CSS_SELECTORS.SEE_MORE)) {
        try {
            log.info('Clicking see more', { url: page.url() });

            const promise = page.waitForResponse((r) => {
                return r.url().includes('ajax/bootloader-endpoint');
            }, { timeout: 10000 });

            await seeMore.evaluate(async (e) => {
                e.closest<HTMLDivElement>('[role="button"]')?.click();
            });
            await promise;

            await sleep(2000);

            clicks++;

            break;
        } catch (e) {
            log.debug(`See more error: ${e.message}`, { url: page.url() });
        }
    }

    if (clicks === 0) {
        log.debug('No See more found', { url: page.url() });
    }

    return clicks > 0;
};
