# Facebook Page Crawler

Extract public information from Facebook Pages.

## Usage

If you want to run the actor on the Apify platform, you need to have at least a proxy so that Facebook doesn't block you. Since it uses Puppeteer, the minimum memory for running is 4096 MB.

## Expected Consumption

One page and posts take around 5-7 minutes for the default amount of information (3 posts, 15 comments) to be generated, also depends on the proxy type used (`RESIDENTIAL` vs `DATACENTER`), block rate, retries, memory and CPU provided.

Usually, more concurrency is not better, while 5-10 concurrent tasks can finish each around 30s-60s, a 20 concurrency can take up to 300s each. You can limit your concurrency by setting the `MAX_CONCURRENCY` environment variable on your actor.

A 4096MB actor will take an average 0.07 CU for each page on default settings. More input page URLs means more memory needed to scrape all pages.

**WARNING**: Don't use a limit too high for `maxPosts` as you can lose everything due to out of memory or it may never finish. While scrolling the page, the partial content is kept in memory until the scrolling finishes.

Take into account the need for proxies that will be included in the costs

## Input

Example input, only `startUrls` and `proxyConfiguration` are required (check `INPUT_SCHEMA.json` for settings):

```json
{
    "startUrls": [
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
    "Hotel",
    "Lázně"
  ],
  "info": [
    "Luxury 5 star hotel in former monastery complex in Prague, Czech Republic."
  ],
  "likes": 4065,
  "messenger": "https://m.me/1" ...,
  "posts": [
    {
      "date": "2020-03-08T15:35:51.000Z",
      "text": "Our guest " ...,
      "images": [
        {
          "link": "https://www.facebook.com/.../photos" ...,
          "image": "https://scontent-prg1-1.xx.fbcdn.net/v/t1.0-0/" ...
        }
      ],
      "links": [],
      "url": "https://www.facebook.com/permalink.php?story_fbid="...,
      "stats": {
        "comments": 4,
        "reactions": 66,
        "shares": 2
      },
      "comments": {
        "count": 2,
        "mode": "RANKED_THREADED",
        "comments": [
          {
            "date": "2020-03-08T22:13:10.000Z",
            "name": "Caro" ...,
            "profileUrl": null,
            "text": "Wow..." ...,
            "url": "https://www.facebook.com/.../posts/" ...
          },
          {
            "date": "2020-03-08T16:10:43.000Z",
            "name": "Bri" ...,
            "profileUrl": "https://www.facebook.com/b" ...,
            "text": "Dan" ...,
            "url": "https://www.facebook.com/.../posts/" ...
          }
        ]
      }
    }
  ],
  "priceRange": "$$$$",
  "reviews": {
    "reviews": [
      {
        "title": "Phi" ...,
        "text": "Très "...,
        "attributes": [
          "Romantická atmosféra",
          "Luxusní hotelová kosmetika",
          "Důmyslné zařízení",
          "Nápo"
        ],
        "url": "https://www.facebook.com/permalink.php?story_fbid=" ...,
        "date": "2020-02-14T20:42:37.000Z",
        "canonical": "https://m.facebook.com/story.php?story_fbid=" ...
      }
    ],
    "average": 4.8,
    "count": 225
  },
  "services": [
    {
      "title": "The Refectory",
      "text": "In The Refectory "...
    }
  ],
  "title": "Hotel, Prague",
  "url": "https://www.facebook.com/...",
  "address": {
    "city": "Praha",
    "lat": 50.08905444,
    "lng": 14.40639193,
    "postalCode": "118 00",
    "region": "Prague",
    "street": "Letenská 12/33"
  },
  "awards": [],
  "email": "email@" ...,
  "impressum": [],
  "instagram": null,
  "phone": "+420 266 112 233",
  "products": [],
  "transit": null,
  "twitter": null,
  "website": "https://www.mar" ...,
  "youtube": null,
  "mission": [],
  "overview": [],
  "payment": null,
  "checkins": "11 504 lidí tu oznámilo svoji polohu",
  "#startedAt": "2020-03-31T17:26:01.919Z",
  "verified": true,
  "#url": "https://m.facebook.com/pg/...",
  "#ref": "https://www.facebook.com/.../",
  "#version": 1,
  "#finishedAt": "2020-03-31T17:34:22.979Z"
}
```

## Advanced Usage

You can use the `unwind` parameter to display only the posts from your dataset on the platform, as such:

```
https://api.apify.com/v2/datasets/zbg3vVF3NnXGZfdsX/items?format=json&clean=1&unwind=posts&fields=posts,title,pageUrl
```

`unwind` will turn the `posts` property on the dataset to become the dataset items themselves. the `fields` parameters makes sure to only include the fields that are important

## Limitations / Caveats

* Pages "Likes" count is a best-effort. The mobile page doesn't provide the count, and some languages don't provide any at all. So if a page has 1.9M, the number will most likely be 1900000 instead of the exact number.
* No content, stats or comments for live stream posts
* There's a known issue that some posts can make the crawler hang for a long time, using all the CPU. It's an edge case that involves a lot of variables to happen, but it's common to happen with a shared post from another live stream with links on both posts.
* New reviews don't contain a rating from 1 to 5, but rather is positive or negative
* Cut-off date for posts happen on the original posted date, not edited date, i.e: posts show as `February 20th 2:11AM`, but that's the edited date, the actual post date is `February 19th 11:31AM` provided on the DOM
* The order of items aren't necessarily the same as seen on the page, and not sorted by date
* Comments of comments are skipped

## Versioning

This project adheres to semver.

* Major versions means a change in the output or input format, and change in behavior.
* Minor versions means new features
* Patch versions means bug fixes / optimizations

## License

Apache-2.0
