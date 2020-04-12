# 1.1.0

* Date input now allows relative time, such as `1 day`, `2 months`, `1 year`

# 1.0.0

* Changed fields on dataset (to allow `unwind` to work properly):
  * `url` -> `pageUrl`
  * `posts.text` -> `posts.postText`
  * `posts.date` -> `posts.postDate`
  * `posts.url` -> `posts.postUrl`
  * `posts.stats` -> `posts.postStats`
  * `posts.comments` -> `posts.postComments`
  * `posts.images` ->`posts.postImages`
  * `posts.links` -> `posts.postLinks`
* Dataset version set to 2

# 0.2.1

* Changes in scroll code and optimizations
