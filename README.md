# Facebook Page Crawler

Extract public information from Facebook Pages.

## Usage

If you want to run the actor on Apify platform, you need to have at least a proxy so that Facebook doesn't block you. Since it uses Puppeteer, the minumum memory for running is 4096 MB.

## Expected Consumption

One page and posts takes around 7 minutes for the default amount of information (3 posts, 15 comments), also depends on proxy type used (`RESIDENTIAL` vs `DATACENTER`), block rate, retries, memory and CPU provided.

## Input

Example input, only `startUrls` and `proxyConfiguration` are required (check `INPUT_SCHEMA.json` for settings):

```json
{
    "startUrls": [
        { "url": "https://www.facebook.com/AugustinePrague/" },
        { "url": "https://www.facebook.com/biz/hotel-supply-service/?place_id=103095856397524" }
    ],
    "language": "cs-CZ",
    "maxPosts": 1,
    "pageInfo": ["posts", "about", "reviews", "services"],
    "proxyConfiguration": {
        "useApifyProxy": true
    },
    "maxPostComments": 15,
    "maxReviews": 3
}
```

## Output

```json
{
  "categories": [
    "Software",
    "Produkt/služba",
    "Internetová společnost"
  ],
  "info": [
    "Impresum"
  ],
  "likes": 385,
  "messenger": "https://m.me/481921368656067",
  "posts": [
    {
      "date": "2020-03-23T14:32:38.000Z",
      "text": "Home but still going ...",
      "images": [
        {
          "link": "https://www.facebook.com/apifytech/photos...",
          "image": "https://scontent-iad3-1.xx.fbcdn.net/v/...."
        }
      ],
      "links": [],
      "url": "https://www.facebook.com/apifytech/posts/1529690213879172",
      "stats": {
        "comments": 0,
        "reactions": 16,
        "shares": 0
      },
      "comments": {
        "count": 0,
        "comments": []
      }
    }
  ],
  "priceRange": null,
  "reviews": {
    "reviews": [],
    "average": 0,
    "count": 0
  },
  "services": [],
  "title": "Apify",
  "url": "https://www.facebook.com/apifytech",
  "lat": null,
  "lng": null,
  "address": null,
  "awards": [],
  "email": null,
  "impressum": [],
  "instagram": null,
  "phone": null,
  "products": [],
  "transit": null,
  "twitter": null,
  "website": "https://apify.com/",
  "youtube": null,
  "mission": [],
  "overview": [],
  "payment": null,
  "checkins": "13 lidí tu oznámilo svoji polohu",
  "#startedAt": "2020-03-25T04:34:57.139Z",
  "verified": false,
  "#url": "https://m.facebook.com/pg/apifytech",
  "#ref": "https://www.facebook.com/apifytech",
  "#finishedAt": "2020-03-25T04:36:03.218Z"
}
```

## Limitations / Caveats

* Pages "Likes" count are a best-effort. The mobile page doesn't provide the count, and some languages don't provide any at all. So if a page has 1.9M, the number will most likely be 1900000 instead of the exact number.
* No content, stats or comments for live stream posts
* There's a known issue that some post can make the crawler hang for a long time, using all the CPU. It's an edge case that involves a lot of variables to happen, but it's common to happen with a shared post from another live stream with links on both posts.
* New reviews don't contain a rating from 1 to 5, but rather is positive or negative
* Cut-off date for posts happen on original posted date, not edited date, i.e: posts shows as `February 20th 2:11AM`, but that's the editted date, the actual post date is `February 19th 11:31AM` provided on the DOM
* The order of items aren't necessarily the same as seen on the page, and not sorted by date
* Comments of comments are skipped

## License

Apache-2.0
