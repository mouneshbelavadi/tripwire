# SerpApi engine-document coverage ledger

Retrieved 21 November 2026. All 189 API-labelled or API-path pages discovered in the main documentation navigation were fetched. This count includes result-feature and helper APIs, not just independent engines. This is a mechanical parameter/example audit, with the three proposed engines reviewed in depth in RESEARCH.md. No authenticated search was used to collect this ledger.

Asterisks mark parameters labelled Required on the page; conditional requirements remain in the linked documentation. Result names are example top-level keys, not a guarantee of presence or an exhaustive schema. Helper/result pages may have no independently stated engine. No engine popularity is inferred from this list.

## 1. Google Search Engine Results API
[Official documentation](https://serpapi.com/search-api) · Engine: `result feature / auxiliary / see source`

Inputs: `q`*, `location`, `uule`, `lat`, `lon`, `radius`, `ludocid`, `lsig`, `kgmid`, `si`, `ibp`, `uds`, `color_scheme`, `google_domain`, `gl`, `hl`, `cr`, `lr`, `tbs`, `safe`, `nfpr`, `filter`, `tbm`, `udm`, `start`, `engine`, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `recipes_results`, `shopping_results`, `local_map`, `local_results`, `knowledge_graph`, `discover_more_places`, `related_questions`, `organic_results`, `related_searches`, `pagination`, `serpapi_pagination`

## 2. Google About This Result API
[Official documentation](https://serpapi.com/google-about-this-result) · Engine: `google_about_this_result`

Inputs: `q`, `google_domain`, `gl`, `hl`, `req_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `about_this_result`

## 3. Google Light Search API
[Official documentation](https://serpapi.com/google-light-api) · Engine: `google_light`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `related_questions`, `related_searches`, `serpapi_pagination`

## 4. Google AI Mode API
[Official documentation](https://serpapi.com/google-ai-mode-api) · Engine: `google_ai_mode`

Inputs: `q`*, `location`, `uule`, `gl`, `hl`, `continuable`, `subsequent_request_token`, `image_url`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `quick_results`, `shopping_results`, `text_blocks`, `reconstructed_markdown`, `references`, `local_results`, `inline_images`, `inline_videos`, `subsequent_request_token`, `related_questions`, `error`

## 5. Google AI Overview API
[Official documentation](https://serpapi.com/google-ai-overview-api) · Engine: `google_ai_overview`

Inputs: `page_token`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `ai_overview`

## 6. Google Gemini API
[Official documentation](https://serpapi.com/google-gemini-api) · Engine: `google_gemini`

Inputs: `q`*, `subsequent_request_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `text_blocks`, `reconstructed_markdown`, `subsequent_request_token`, `references`, `local_results`, `shopping_results`, `inline_images`, `related_questions`, `search_information`, `error`

## 7. Google Ads API
[Official documentation](https://serpapi.com/google-ads-api) · Engine: `google_ads`

Inputs: `q`*, `location`*, `hl`, `safe`, `nfpr`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `ads`, `inline_videos`, `related_questions`, `ai_overview`, `organic_results`, `related_searches`, `local_ads`, `shopping_results`

## 8. Google Ads Transparency Center API
[Official documentation](https://serpapi.com/google-ads-transparency-center-api) · Engine: `google_ads_transparency_center`

Inputs: `advertiser_id`, `text`, `platform`, `political_ads`, `get_advertiser`, `region`, `start_date`, `end_date`, `creative_format`, `num`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `advertiser`, `ad_creatives`, `serpapi_pagination`

## 9. Google Ads Transparency Center Ad Details API
[Official documentation](https://serpapi.com/google-ads-transparency-center-ad-details) · Engine: `google_ads_transparency_center_ad_details`

Inputs: `advertiser_id`*, `creative_id`*, `region`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `ad_creatives`

## 10. Google Autocomplete API
[Official documentation](https://serpapi.com/google-autocomplete-api) · Engine: `google_autocomplete`

Inputs: `q`*, `gl`, `hl`, `cp`, `client`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `suggestions`, `verbatim_relevance`

## 11. Google Books API
[Official documentation](https://serpapi.com/google-books-api) · Engine: `google_books`

Inputs: `q`*, `google_domain`, `gl`, `hl`, `view`, `document_type`, `start_date`, `end_date`, `nfpr`, `tbs`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `organic_results`, `serpapi_pagination`, `search_information`

## 12. Google Events API
[Official documentation](https://serpapi.com/google-events-api) · Engine: `google_events`

Inputs: `q`*, `location`, `uule`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `events_map`, `events_results`

## 13. Google Event Details API
[Official documentation](https://serpapi.com/google-event-details-api) · Engine: `google_event_details`

Inputs: `event_token`*, `gl`, `hl`, `nearby_places`, `similar_events`, `search_results`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `event_details`

## 14. Google Finance API
[Official documentation](https://serpapi.com/google-finance-api) · Engine: `google_finance`

Inputs: `q`*, `hl`, `window`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `graph`, `summary`, `knowledge_graph`, `news_results`, `financials`, `discover_more`, `markets`, `key_events`, `suggestions`

## 15. Google Finance Autocomplete API
[Official documentation](https://serpapi.com/google-finance-autocomplete-api) · Engine: `google_finance_autocomplete`

Inputs: `q`*, `gl`, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `suggestions`

## 16. Google Finance Markets API
[Official documentation](https://serpapi.com/google-finance-markets) · Engine: `google_finance_markets`

Inputs: `trend`*, `hl`, `gl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `markets`, `news_results`

## 17. Google Flights API
[Official documentation](https://serpapi.com/google-flights-api) · Engine: `google_flights`

Inputs: `departure_id`, `arrival_id`, `gl`, `hl`, `currency`, `type`, `outbound_date`, `return_date`, `travel_class`, `multi_city_json`, `show_hidden`, `exclude_basic`, `deep_search`, `adults`, `children`, `infants_in_seat`, `infants_on_lap`, `sort_by`, `stops`, `exclude_airlines`, `include_airlines`, `bags`, `max_price`, `outbound_times`, `return_times`, `emissions`, `layover_duration`, `exclude_conns`, `max_duration`, `selected_flights_json`, `departure_token`, `booking_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `best_flights`, `other_flights`, `price_insights`, `airports`

## 18. Google Flights Autocomplete API
[Official documentation](https://serpapi.com/google-flights-autocomplete-api) · Engine: `google_flights_autocomplete`

Inputs: `q`*, `gl`, `hl`, `exclude_regions`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `suggestions`

## 19. Google Flights Calendar API
[Official documentation](https://serpapi.com/google-flights-calendar-api) · Engine: `google_flights_calendar`

Inputs: `departure_id`*, `arrival_id`*, `gl`, `hl`, `currency`, `type`, `date_range_start`, `date_range_end`, `round_trip_days`, `fixed_outbound_date`, `travel_class`, `adults`, `children`, `infants_in_seat`, `infants_on_lap`, `stops`, `exclude_airlines`, `include_airlines`, `outbound_times`, `return_times`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `prices`

## 20. Google Flights Deals API
[Official documentation](https://serpapi.com/google-flights-deals-api) · Engine: `google_flights_deals`

Inputs: `departure_id`, `gl`, `hl`, `currency`, `query`, `type`, `travel_class`, `outbound_date`, `return_date`, `travel_duration`, `trip_length`, `adults`, `children`, `infants_in_seat`, `infants_on_lap`, `stops`, `exclude_airlines`, `include_airlines`, `max_price`, `max_duration`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `departure_informations`, `deals`

## 21. Google Forums API
[Official documentation](https://serpapi.com/google-forums-api) · Engine: `google_forums`

Inputs: `q`*, `location`, `uule`, `gl`, `hl`, `period_unit`, `period_value`, `start_date`, `end_date`, `start`, `nfpr`, `filter`, `tbs`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `related_searches`, `serpapi_pagination`

## 22. Google Hotels API
[Official documentation](https://serpapi.com/google-hotels-api) · Engine: `google_hotels`

Inputs: `q`*, `gl`, `hl`, `currency`, `check_in_date`*, `check_out_date`*, `adults`, `children`, `children_ages`, `geo_search`, `sort_by`, `min_price`, `max_price`, `property_types`, `amenities`, `rating`, `brands`, `hotel_class`, `free_cancellation`, `special_offers`, `eco_certified`, `vacation_rentals`, `bedrooms`, `bathrooms`, `next_page_token`, `property_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_information`, `brands`, `ads`, `properties`, `serpapi_pagination`, `search_metadata`, `search_parameters`, `type`, `name`, `description`, `link`, `property_token`, `serpapi_property_details_link`, `address`, `directions`, `phone`, `phone_link`, `gps_coordinates`, `check_in_time`, `check_out_time`, `total_rate`

## 23. Google Hotels Autocomplete API
[Official documentation](https://serpapi.com/google-hotels-autocomplete-api) · Engine: `google_hotels_autocomplete`

Inputs: `q`*, `gl`, `hl`, `currency`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_parameters`, `suggestions`

## 24. Google Hotels Price Calendar API
[Official documentation](https://serpapi.com/google-hotels-price-calendar-api) · Engine: `google_hotels_price_calendar`

Inputs: `property_token`*, `start_date`*, `end_date`*, `adults`, `children`, `children_ages`, `gl`, `hl`, `currency`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `prices`

## 25. Google Hotels Photos API
[Official documentation](https://serpapi.com/google-hotels-photos-api) · Engine: `google_hotels_photos`

Inputs: `property_token`*, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_parameters`, `sections`, `photos`

## 26. Google Hotels Reviews API
[Official documentation](https://serpapi.com/google-hotels-reviews-api) · Engine: `google_hotels_reviews`

Inputs: `property_token`*, `hl`, `category_token`, `sort_by`, `source_number`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `reviews`, `serpapi_pagination`

## 27. Google Images API
[Official documentation](https://serpapi.com/google-images-api) · Engine: `google_images`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `cr`, `period_unit`, `period_value`, `start_date`, `end_date`, `chips`, `tbs`, `imgar`, `imgsz`, `image_color`, `image_type`, `licenses`, `safe`, `nfpr`, `filter`, `ijn`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `suggested_searches`, `images_results`, `related_searches`, `serpapi_pagination`, `shopping_results`

## 28. Google Images Light API
[Official documentation](https://serpapi.com/google-images-light-api) · Engine: `google_images_light`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `cr`, `period_unit`, `period_value`, `start_date`, `end_date`, `tbs`, `imgar`, `imgsz`, `image_color`, `image_type`, `licenses`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `images_results`, `serpapi_pagination`

## 29. Google Images Related Content API
[Official documentation](https://serpapi.com/google-images-related-content-api) · Engine: `google_images_related_content`

Inputs: `related_content_id`*, `q`, `hl`, `gl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `related_content`, `related_searches`, `see_more_link`, `serpapi_see_more_link`

## 30. Google Immersive Product API
[Official documentation](https://serpapi.com/google-immersive-product-api) · Engine: `google_immersive_product`

Inputs: `page_token`*, `more_stores`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_results`, `related_searches`

## 31. Google Jobs API
[Official documentation](https://serpapi.com/google-jobs-api) · Engine: `google_jobs`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `next_page_token`, `chips`, `lrad`, `ltype`, `uds`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `filters`, `jobs_results`

## 32. Google Jobs Listing Results API
[Official documentation](https://serpapi.com/google-jobs-listing-api) · Engine: `google_jobs_listing`

Inputs: `q`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `ratings`

## 33. Google Lens API
[Official documentation](https://serpapi.com/google-lens-api) · Engine: `google_lens`

Inputs: `url`*, `hl`, `country`, `type`*, `q`, `safe`, `auto_crop`, `image_id`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `visual_matches`, `related_content`, `ai_overview`, `organic_results`, `short_videos`

## 34. Google Local API
[Official documentation](https://serpapi.com/google-local-api) · Engine: `google_local`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `ludocid`, `tbs`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `ads_results`, `local_results`, `discover_more_places`, `pagination`, `serpapi_pagination`, `local_map`

## 35. Google Local Services API
[Official documentation](https://serpapi.com/google-local-services-api) · Engine: `google_local_services`

Inputs: `q`*, `data_cid`*, `hl`, `job_type`, `cid`, `bid`, `pid`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `local_ads`

## 36. Google Maps API
[Official documentation](https://serpapi.com/google-maps-api) · Engine: `google_maps`

Inputs: `q`, `ll`, `location`, `lat`, `lon`, `z`, `m`, `nearby`, `google_domain`, `hl`, `gl`, `data`, `place_id`, `data_cid`, `type`*, `min_price`, `max_price`, `min_rating`, `open_state`, `open_on_day`, `open_at_hour`, `start`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `local_results`, `serpapi_pagination`

## 37. Google Maps Photos API
[Official documentation](https://serpapi.com/google-maps-photos-api) · Engine: `google_maps_photos`

Inputs: `data_id`*, `hl`, `category_id`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `photos`, `serpapi_pagination`, `categories`

## 38. Google Maps Photo Meta API
[Official documentation](https://serpapi.com/google-maps-photo-meta-api) · Engine: `google_maps_photo_meta`

Inputs: `data_id`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `user`, `location`, `date`

## 39. Google Maps Autocomplete API
[Official documentation](https://serpapi.com/google-maps-autocomplete-api) · Engine: `google_maps_autocomplete`

Inputs: `q`*, `ll`*, `gl`, `hl`, `cp`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `suggestions`

## 40. Google Maps Directions API
[Official documentation](https://serpapi.com/google-maps-directions-api) · Engine: `google_maps_directions`

Inputs: `start_addr`, `end_addr`, `gl`, `hl`, `travel_mode`, `start_data_id`, `end_data_id`, `start_coords`, `end_coords`, `distance_unit`, `avoid`, `prefer`, `route`, `time`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `places_info`, `directions`, `durations`

## 41. Google Maps Traffic API
[Official documentation](https://serpapi.com/google-maps-traffic-api) · Engine: `google_maps_traffic`

Inputs: `bbox`*, `gl`, `hl`, `zoom`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `traffic_incidents`, `search_metadata`, `search_parameters`, `error`

## 42. Google Maps Posts API
[Official documentation](https://serpapi.com/google-maps-posts-api) · Engine: `google_maps_posts`

Inputs: `data_id`*, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `posts`, `serpapi_pagination`

## 43. Google Maps Reviews API
[Official documentation](https://serpapi.com/google-maps-reviews-api) · Engine: `google_maps_reviews`

Inputs: `data_id`, `hl`, `place_id`, `sort_by`, `topic_id`, `query`, `num`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `place_info`, `topics`, `reviews`, `serpapi_pagination`

## 44. Google Maps Contributor Reviews API
[Official documentation](https://serpapi.com/google-maps-contributor-reviews-api) · Engine: `google_maps_contributor_reviews`

Inputs: `contributor_id`*, `gl`, `hl`, `num`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `contributor`, `reviews`

## 45. Google News API
[Official documentation](https://serpapi.com/google-news-api) · Engine: `google_news`

Inputs: `q`, `gl`, `hl`, `topic_token`, `kgmid`, `publication_token`, `section_token`, `story_token`, `so`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `news_results`, `menu_links`, `title`, `sub_menu_links`, `top_stories_link`, `related_topics`, `related_publications`

## 46. Google News Light API
[Official documentation](https://serpapi.com/google-news-light-api) · Engine: `google_news_light`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `news_results`, `serpapi_pagination`

## 47. Google Patents API
[Official documentation](https://serpapi.com/google-patents-api) · Engine: `google_patents`

Inputs: `q`, `page`, `num`, `sort`, `clustered`, `dups`, `patents`, `scholar`, `before`, `after`, `inventor`, `assignee`, `country`, `language`, `status`, `type`, `litigation`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `summary`, `pagination`, `serpapi_pagination`

## 48. Google Patents Details API
[Official documentation](https://serpapi.com/google-patents-details-api) · Engine: `google_patents_details`

Inputs: `patent_id`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `title`, `type`, `pdf`, `publication_number`, `country`, `prior_art_keywords`, `prior_art_date`, `application_number`, `inventors`, `assignees`, `priority_date`, `filing_date`, `publication_date`, `worldwide_applications`, `events`, `external_links`, `images`, `classifications`, `abstract`, `description_link`, `claims`, `child_applications`, `parent_applications`, `priority_applications`, `applications_claiming_priority`, `family_id`, `patent_citations`, `non_patent_citations`, `cited_by`, `similar_documents`, `legal_events`, `header`, `publication_year`, `publication_venue`, `full_view_url`, `institution_url`, `cited_by_url`, `main_url`, `other_versions_url`, `authors`, `snippet`, `concepts`, `priority_year`, `abstract_original`, `description_link_translated`, `claims_translated`

## 49. Google Play Store API
[Official documentation](https://serpapi.com/google-play-api) · Engine: `google_play`

Inputs: `q`, `gl`, `hl`, `apps_category`, `store_device`, `age`, `next_page_token`, `section_page_token`, `chart`, `see_more_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `organic_results`, `serpapi_pagination`, `top_charts`, `chart_options`, `items_highlight`, `app_highlight`, `related_searches`

## 50. Google Play Games Store API
[Official documentation](https://serpapi.com/google-play-games) · Engine: `google_play_games`

Inputs: `q`, `gl`, `hl`, `games_category`, `store_device`, `next_page_token`, `section_page_token`, `chart`, `see_more_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `items_highlight`, `organic_results`, `serpapi_pagination`, `top_charts`, `chart_options`, `app_highlight`

## 51. Google Play Movies Store API
[Official documentation](https://serpapi.com/google-play-movies) · Engine: `google_play_movies`

Inputs: `q`, `gl`, `hl`, `movies_category`, `age`, `next_page_token`, `section_page_token`, `chart`, `see_more_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `chart_options`, `organic_results`, `top_charts`, `serpapi_pagination`

## 52. Google Play Books Store API
[Official documentation](https://serpapi.com/google-play-books) · Engine: `google_play_books`

Inputs: `q`, `gl`, `hl`, `books_category`, `price`, `age`, `next_page_token`, `section_page_token`, `chart`, `see_more_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `chart_options`, `organic_results`, `top_charts`, `items_highlight`, `serpapi_pagination`

## 53. Google Play Product API
[Official documentation](https://serpapi.com/google-play-product-api) · Engine: `google_play_product`

Inputs: `product_id`*, `gl`, `hl`, `store`*, `season_id`, `all_reviews`, `platform`, `rating`, `sort_by`, `num`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_info`, `media`, `about_this_app`, `badges`, `categories`, `updated_on`, `data_safety`, `what_s_new`, `ratings`, `reviews`, `serpapi_pagination`, `developer_contact`, `similar_results`, `featured_stories`

## 54. Google Product API
[Official documentation](https://serpapi.com/google-product-api) · Engine: `google_product`

Inputs: `product_id`, `page_token`, `offer_view`, `gl`, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_results`, `search_information`

## 55. Google Related Questions API
[Official documentation](https://serpapi.com/google-related-questions-api) · Engine: `google_related_questions`

Inputs: `next_page_token`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `related_questions`

## 56. Google Reverse Image API
[Official documentation](https://serpapi.com/google-reverse-image) · Engine: `google_reverse_image`

Inputs: `q`, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `start`, `image_url`*, `safe`, `tbs`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `visual_matches`, `search_metadata`, `search_parameters`, `search_information`, `image_results`, `image_sizes`, `inline_images`, `knowledge_graph`

## 57. Google Scholar API
[Official documentation](https://serpapi.com/google-scholar-api) · Engine: `google_scholar`

Inputs: `q`*, `cites`, `as_ylo`, `as_yhi`, `scisbd`, `cluster`, `hl`, `lr`, `start`, `num`, `as_sdt`, `safe`, `filter`, `as_vis`, `as_rr`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `related_searches`, `pagination`, `serpapi_pagination`, `citations_per_year`, `profiles`

## 58. Google Scholar Cite API
[Official documentation](https://serpapi.com/google-scholar-cite-api) · Engine: `google_scholar_cite`

Inputs: `q`*, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `citations`, `links`

## 59. Google Scholar Author API
[Official documentation](https://serpapi.com/google-scholar-author-api) · Engine: `google_scholar_author`

Inputs: `author_id`*, `hl`, `view_op`, `sort`, `citation_id`, `start`, `num`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `author`, `articles`, `cited_by`, `public_access`, `co_authors`, `serpapi_pagination`

## 60. Google Scholar Case Law API
[Official documentation](https://serpapi.com/google-scholar-case-law-api) · Engine: `google_scholar_case_law`

Inputs: `case_id`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `case_results`

## 61. Google Shopping API
[Official documentation](https://serpapi.com/google-shopping-api) · Engine: `google_shopping`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `shoprs`, `min_price`, `max_price`, `sort_by`, `free_shipping`, `on_sale`, `small_business`, `safe`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `filters`, `inline_shopping_results`, `categorized_shopping_results`, `shopping_results`, `carousel_filters`

## 62. Google Shopping Light API
[Official documentation](https://serpapi.com/google-shopping-light-api) · Engine: `google_shopping_light`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `shoprs`, `min_price`, `max_price`, `sort_by`, `free_shipping`, `on_sale`, `small_business`, `safe`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `shopping_results`, `inline_shopping_results`, `categorized_shopping_results`, `serpapi_pagination`

## 63. Google Shopping Filters API
[Official documentation](https://serpapi.com/google-shopping-filters-api) · Engine: `google_shopping_filters`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `shoprs`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `filters`

## 64. Google Short Videos API
[Official documentation](https://serpapi.com/google-short-videos-api) · Engine: `google_short_videos`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `tbs`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `short_video_results`, `serpapi_pagination`, `people_also_search_for`

## 65. Google Sports API
[Official documentation](https://serpapi.com/google-sports-api) · Engine: `google_sports`

Inputs: `kgmid`*, `gl`, `hl`, `mpd`, `moa`, `mob`, `season_kgmid`, `sp`*, `type`*, `tab`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `league_results`, `team_results`, `game_results`

## 66. Google Translate API
[Official documentation](https://serpapi.com/google-translate-api) · Engine: `google_translate`

Inputs: `text`*, `from`*, `to`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `translation`, `search_information`

## 67. Google Travel Explore API
[Official documentation](https://serpapi.com/google-travel-explore-api) · Engine: `google_travel_explore`

Inputs: `departure_id`*, `gl`, `hl`, `currency`, `arrival_area_id`, `arrival_id`, `type`, `outbound_date`, `return_date`, `month`, `travel_duration`, `travel_class`, `adults`, `children`, `infants_in_seat`, `infants_on_lap`, `stops`, `travel_mode`, `interest`, `include_airlines`, `exclude_airlines`, `bags`, `max_price`, `max_duration`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `destinations`, `start_date`, `end_date`, `flights`, `google_flights_link`, `google_flights_serpapi_link`

## 68. Google Trends API
[Official documentation](https://serpapi.com/google-trends-api) · Engine: `google_trends`

Inputs: `q`*, `hl`, `geo`, `region`, `data_type`, `tz`, `cat`, `gprop`, `date`, `csv`, `include_low_search_volume`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `interest_over_time`, `compared_breakdown_by_region`, `interest_by_region`, `related_topics`, `related_queries`

## 69. Google Trends Autocomplete API
[Official documentation](https://serpapi.com/google-trends-autocomplete) · Engine: `google_trends_autocomplete`

Inputs: `q`*, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `suggestions`

## 70. Google Trends Trending Now API
[Official documentation](https://serpapi.com/google-trends-trending-now) · Engine: `google_trends_trending_now`

Inputs: `geo`*, `hours`, `category_id`, `only_active`, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `trending_searches`, `search_metadata`, `search_parameters`

## 71. Google Trends News API
[Official documentation](https://serpapi.com/google-trends-news) · Engine: `google_trends_news`

Inputs: `page_token`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `news`

## 72. Google Videos API
[Official documentation](https://serpapi.com/google-videos-api) · Engine: `google_videos`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `tbs`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `video_results`, `related_searches`, `pagination`, `serpapi_pagination`, `found_in_videos`, `short_videos`

## 73. Google Videos Light API
[Official documentation](https://serpapi.com/google-videos-light-api) · Engine: `google_videos_light`

Inputs: `q`*, `location`, `uule`, `google_domain`, `gl`, `hl`, `lr`, `tbs`, `safe`, `nfpr`, `filter`, `start`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `filters`, `video_results`, `related_searches`, `serpapi_pagination`, `videos_results`

## 74. Airbnb Search API
[Official documentation](https://serpapi.com/airbnb-search-api) · Engine: `airbnb`

Inputs: `q`, `map_bounds`, `airbnb_domain`, `currency`, `check_in_date`, `check_out_date`, `adults`, `children`, `infants`, `pets`, `room_type`, `min_price`, `max_price`, `bedrooms`, `beds`, `bathrooms`, `property_types`, `amenities`, `accessibility_features`, `host_languages`, `instant_book`, `self_check_in`, `guest_favorite`, `luxe`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `serpapi_pagination`

## 75. Amazon Search API
[Official documentation](https://serpapi.com/amazon-search-api) · Engine: `amazon`

Inputs: `k`, `amazon_domain`, `language`, `delivery_zip`, `delivery_city`, `shipping_location`, `s`, `node`, `rh`, `emi`, `dc`, `page`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `product_ads`, `organic_results`, `categories`, `filters`, `featured_products`, `video_results`, `related_searches`, `sponsored_brands`, `pagination`, `serpapi_pagination`

## 76. Amazon Autocomplete API
[Official documentation](https://serpapi.com/amazon-autocomplete-api) · Engine: `amazon_autocomplete`

Inputs: `k`*, `amazon_domain`, `amazon_department`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `suggestions`

## 77. Amazon Fresh API
[Official documentation](https://serpapi.com/amazon-fresh-api) · Engine: `amazon_fresh`

Inputs: `k`, `delivery_zip`*, `amazon_domain`, `language`, `s`, `node`, `rh`, `dc`, `page`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_parameters`, `search_information`, `organic_results`, `filters`, `serpapi_pagination`, `video_results`, `sponsored_brands`

## 78. Amazon Pharmacy API
[Official documentation](https://serpapi.com/amazon-pharmacy-api) · Engine: `amazon_pharmacy`

Inputs: `k`*, `language`, `delivery_zip`, `s`, `rh`, `dc`, `page`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `organic_results`, `serpapi_pagination`, `search_information`, `filters`

## 79. Amazon Product API
[Official documentation](https://serpapi.com/amazon-product-api) · Engine: `amazon_product`

Inputs: `asin`*, `amazon_domain`, `language`, `delivery_zip`, `delivery_city`, `shipping_location`, `other_sellers`, `all_related_products`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_results`, `purchase_options`, `item_ingredients`, `item_specifications`, `about_item`, `bought_together`, `related_products`, `sustainability_features`, `product_description`, `product_details`, `important_information`, `sponsored_brands`, `reviews_information`, `protection_plan`, `prices`, `product_features`, `related_product_sections`, `compare_with_similar`, `similar_product_videos`, `videos`, `about_the_author`, `editorial_reviews`, `other_sellers`

## 80. Amazon Promotion API
[Official documentation](https://serpapi.com/amazon-promotion-api) · Engine: `amazon_promotion`

Inputs: `promotion_id`*, `amazon_domain`, `language`, `include_products`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `promotion_results`, `qualifying_items`, `qualifying_items_truncated`

## 81. Apple App Store Search Scraper API
[Official documentation](https://serpapi.com/apple-app-store) · Engine: `apple_app_store`

Inputs: `term`*, `country`, `lang`, `num`, `disallow_explicit`, `property`, `category_id`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `organic_results`, `search_metadata`, `search_parameters`, `search_information`, `serpapi_pagination`

## 82. Apple App Store Reviews Scraper API
[Official documentation](https://serpapi.com/apple-reviews) · Engine: `apple_reviews`

Inputs: `product_id`*, `country`, `page`, `sort`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `reviews`, `serpapi_pagination`

## 83. Apple App Store Product Page Scraper API
[Official documentation](https://serpapi.com/apple-product) · Engine: `apple_product`

Inputs: `product_id`*, `type`, `country`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `title`, `snippet`, `id`, `age_rating`, `developer`, `rating`, `rating_count`, `price`, `in_app_purchases`, `logo`, `iphone_screenshots`, `ipad_screenshots`, `description`, `version_history`, `ratings_and_reviews`, `privacy`, `information`, `supports`, `featured_in`, `you_may_also_like`, `more_by_this_developer`, `designed_for`, `screenshot type, 'iphone_screenshots' stands for iPhone screenshots, 'ipad_screenshots' stands for iPad screenshots etc.`

## 84. Apple Maps Search API
[Official documentation](https://serpapi.com/apple-maps-api) · Engine: `apple_maps`

Inputs: `query`*, `center`, `span`, `location`, `sort`, `toggles`, `multi_select_options`, `open_at`, `locale`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `local_results`, `guide_results`

## 85. Apple Maps Places API
[Official documentation](https://serpapi.com/apple-maps-places-api) · Engine: `apple_maps_places`

Inputs: `muid`*, `locale`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `place_results`

## 86. AutoZone Search API
[Official documentation](https://serpapi.com/autozone-search-api) · Engine: `autozone`

Inputs: `q`*, `store_id`, `vehicle_year`, `vehicle_make`, `vehicle_model`, `vehicle_engine`, `vehicle_submodel`, `vehicle_type`, `sort`, `facet`, `min_price`, `max_price`, `page`, `ps`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`, `include_filters`

Example output keys: `search_information`, `organic_results`, `serpapi_pagination`, `filters`

## 87. AutoZone Product API
[Official documentation](https://serpapi.com/autozone-product-api) · Engine: `autozone_product`

Inputs: `product_id`*, `store_id`, `vehicle_year`, `vehicle_make`, `vehicle_model`, `vehicle_engine`, `vehicle_submodel`, `vehicle_type`, `vehicle_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `product_results`, `search_information`

## 88. Baidu Search Engine Results API
[Official documentation](https://serpapi.com/baidu-search-api) · Engine: `baidu`

Inputs: `q`*, `ct`, `pn`, `rn`, `gpc`, `q5`, `q6`, `bs`, `oq`, `f`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `answer_box`, `pagination`, `serpapi_pagination`

## 89. Baidu News API
[Official documentation](https://serpapi.com/baidu-news-api) · Engine: `baidu_news`

Inputs: `q`*, `ct`, `pn`, `rn`, `rtt`, `medium`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `brand_ad`, `organic_results`, `top_searches`, `pagination`, `serpapi_pagination`

## 90. Baidu Maps API
[Official documentation](https://serpapi.com/baidu-maps-api) · Engine: `baidu_maps`

Inputs: `q`*, `c`, `lat`, `lon`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `local_results`, `serpapi_pagination`, `cities`, `error`, `place_results`

## 91. Bing Search Engine Results API
[Official documentation](https://serpapi.com/bing-search-api) · Engine: `bing`

Inputs: `q`*, `location`, `lat`, `lon`, `mkt`, `cc`, `first`, `safeSearch`, `filters`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `ads`, `organic_results`, `knowledge_graph`, `related_searches`, `pagination`, `serpapi_pagination`, `search_information`

## 92. Bing Shopping API
[Official documentation](https://serpapi.com/bing-shopping-api) · Engine: `bing_shopping`

Inputs: `q`*, `mkt`, `cc`, `efirst`, `filters`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `shopping_results`, `filters`, `ads_results`, `inline_ads_results`, `pagination`, `serpapi_pagination`, `related_searches`

## 93. Bing Product API
[Official documentation](https://serpapi.com/bing-product-api) · Engine: `bing_product`

Inputs: `product_token`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_results`, `reviews_results`, `buying_options`, `variants`

## 94. Bing Maps API
[Official documentation](https://serpapi.com/bing-maps-api) · Engine: `bing_maps`

Inputs: `q`*, `cp`, `setlang`, `place_id`, `first`, `count`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `filters`, `local_results`, `place_results`

## 95. Bing News Engine Results API
[Official documentation](https://serpapi.com/bing-news-api) · Engine: `bing_news`

Inputs: `q`*, `mkt`, `cc`, `first`, `count`, `qft`, `safeSearch`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `organic_results`, `trending_results`, `events`

## 96. Bing Reverse Image API
[Official documentation](https://serpapi.com/bing-reverse-image-api) · Engine: `bing_reverse_image`

Inputs: `image_url`*, `mkt`, `cat`, `cal`, `car`, `cab`, `next_page_token`, `count`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `image_info`, `related_content`, `pages_with_this_image`, `related_searches`, `ads`, `text_recognition`, `crops`, `serpapi_pagination`, `looks_like`

## 97. Bing Videos API
[Official documentation](https://serpapi.com/bing-videos-api) · Engine: `bing_videos`

Inputs: `q`*, `mkt`, `cc`, `setlang`, `first`, `length`, `date`, `resolution`, `source_site`, `price`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `video_results`, `suggested_search_results`, `shopping_results`, `related_search_results`, `ads_results`, `top_highlights`, `shorts_results`

## 98. Bing Copilot API
[Official documentation](https://serpapi.com/bing-copilot-api) · Engine: `bing_copilot`

Inputs: `q`*, `location`, `lat`, `lon`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `header`, `text_blocks`, `references`, `search_metadata`, `search_parameters`, `header_video`, `images_link`, `videos_link`

## 99. Bing Images API
[Official documentation](https://serpapi.com/bing-images-api) · Engine: `bing_images`

Inputs: `q`*, `mkt`, `cc`, `first`, `count`, `imagesize`, `color2`, `photo`, `aspect`, `face`, `age`, `license`, `safeSearch`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `images_results`, `suggested_searches`, `refined_searches`, `related_searches`, `serpapi_pagination`, `content_by_ai`, `explore_more_searches`, `shopping_results`

## 100. Booking.com API
[Official documentation](https://serpapi.com/booking-api) · Engine: `booking`

Inputs: `q`*, `hl`, `currency`, `check_in_date`, `check_out_date`, `flex_window`, `adults`, `children`, `children_ages`, `rooms`, `sort_by`, `min_price`, `max_price`, `hotel_class`, `rating`, `free_cancellation`, `property_types`, `nflt`, `offset`, `limit`, `session_token`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `properties`, `filters`, `serpapi_pagination`

## 101. Brave Search API
[Official documentation](https://serpapi.com/brave-search-api) · Engine: `brave`

Inputs: `q`*, `location`, `lat`, `lon`, `country`, `language`, `safe_search`, `tf`, `spellcheck`, `offset`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `ads`, `knowledge_graph`, `organic_results`, `news_results`, `local_results`, `recipes_results`, `search_information`, `inline_images`, `serpapi_pagination`, `discussions_and_forums`, `related_questions`, `inline_videos`, `related_searches`

## 102. Brave AI Mode API
[Official documentation](https://serpapi.com/brave-ai-mode-api) · Engine: `brave_ai_mode`

Inputs: `q`*, `location`, `lat`, `lon`, `country`, `language`, `safeSearch`, `units_of_measurement`, `subsequent_request_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `markdown`, `text_blocks`, `references`, `web_results`, `related_questions`, `subsequent_request_token`, `error`

## 103. Brave Images API
[Official documentation](https://serpapi.com/brave-images-api) · Engine: `brave_images`

Inputs: `q`*, `country`, `safe_search`, `spelling`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `images_results`, `search_parameters`, `search_information`

## 104. Brave News API
[Official documentation](https://serpapi.com/brave-news-api) · Engine: `brave_news`

Inputs: `q`*, `country`, `language`, `safe_search`, `tf`, `spellcheck`, `offset`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `news_results`, `search_parameters`, `search_information`, `serpapi_pagination`

## 105. Brave Videos API
[Official documentation](https://serpapi.com/brave-videos-api) · Engine: `brave_videos`

Inputs: `q`*, `country`, `safe_search`, `date`, `spelling`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `video_results`, `serpapi_pagination`, `search_parameters`, `search_information`

## 106. DoorDash Search API
[Official documentation](https://serpapi.com/doordash-search-api) · Engine: `doordash`

Inputs: `q`*, `address`*, `store_type`, `min_rating`, `deals`, `fastest`, `pickup`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_information`, `organic_results`, `search_parameters`, `products`, `product_sections`, `filters`, `serpapi_pagination`

## 107. DuckDuckGo Search Engine Results API
[Official documentation](https://serpapi.com/duckduckgo-search-api) · Engine: `duckduckgo`

Inputs: `q`*, `kl`, `search_assist`, `safe`, `df`, `start`, `m`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `ads`, `organic_results`, `knowledge_graph`, `news_results`, `related_searches`, `serpapi_pagination`

## 108. DuckDuckGo Search Assist API
[Official documentation](https://serpapi.com/duckduckgo-search-assist-api) · Engine: `result feature / auxiliary / see source`

Inputs: `search_assist`*

Example output keys: `search_assist`

## 109. Duck AI API
[Official documentation](https://serpapi.com/duck-ai-api) · Engine: `duck_ai`

Inputs: `q`*, `model`, `subsequent_request_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `text_blocks`, `references`, `related_searches`, `markdown`, `subsequent_request_token`, `error`

## 110. DuckDuckGo Maps API
[Official documentation](https://serpapi.com/duckduckgo-maps-api) · Engine: `duckduckgo_maps`

Inputs: `q`*, `bbox`, `lat`, `lon`, `strict_bbox`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `local_results`

## 111. DuckDuckGo News API
[Official documentation](https://serpapi.com/duckduckgo-news-api) · Engine: `duckduckgo_news`

Inputs: `q`*, `kl`, `safe`, `df`, `start`, `m`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `news_results`, `serpapi_pagination`

## 112. DuckDuckGo Shopping API
[Official documentation](https://serpapi.com/duckduckgo-shopping-api) · Engine: `duckduckgo_shopping`

Inputs: `q`*, `kl`, `sort_by`, `filters`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `shopping_results`, `filters`, `serpapi_pagination`

## 113. DuckDuckGo Images API
[Official documentation](https://serpapi.com/duckduckgo-images-api) · Engine: `duckduckgo_images`

Inputs: `q`*, `kl`, `safe`, `df`, `size`, `color`, `image_type`, `layout`, `license`, `hide_ai_images`, `start`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `suggested_searches`, `images_results`, `serpapi_pagination`, `shopping_results`

## 114. DuckDuckGo Light API
[Official documentation](https://serpapi.com/duckduckgo-light-api) · Engine: `duckduckgo_light`

Inputs: `q`*, `kl`, `df`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `ads`, `organic_results`, `serpapi_pagination`

## 115. eBay Search Engine Results API
[Official documentation](https://serpapi.com/ebay-search-api) · Engine: `ebay`

Inputs: `_nkw`*, `ebay_domain`, `_salic`, `_pgn`, `_ipg`, `_blrs`, `show_only`, `buying_format`, `_sasl`, `_saslop`, `popular_filters`, `_udlo`, `_udhi`, `_sop`, `_dmd`, `category_id`, `_stpos`, `LH_ItemCondition`, `LH_PrefLoc`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `categories`, `organic_results`, `related_searches`, `popular_filters`, `pagination`, `serpapi_pagination`, `deals`, `best_selling`, `related_items`

## 116. eBay Product API
[Official documentation](https://serpapi.com/ebay-product-api) · Engine: `ebay_product`

Inputs: `product_id`*, `ebay_domain`, `locale`, `lang`, `shipping_country`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `product_results`, `seller_results`, `related_products`

## 117. eBay Seller API
[Official documentation](https://serpapi.com/ebay-seller-api) · Engine: `ebay_seller`

Inputs: `seller_id`*, `type`*, `ebay_domain`, `_pgn`, `_ipg`, `_sop`, `buying_format`, `LH_ItemCondition`, `free_shipping`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `type`, `name`, `username`, `ssn`, `bio`, `follower_count`, `positive_feedback_in_percentage`, `sold_count`, `profile_link`, `logo_link`, `rating`, `number_of_products`, `popular_categories`, `feedback`, `banner`, `description`, `location`, `member_since`, `overall_rating`, `detailed_rating`, `seller_feedback`, `current`, `next`, `previous`, `other_pages`, `previous_link`, `next_link`

## 118. Eventbrite Search API
[Official documentation](https://serpapi.com/eventbrite-search-api) · Engine: `eventbrite`

Inputs: `q`, `location`, `online`, `date`, `start_date`, `end_date`, `category`, `event_type`, `price`, `sort_by`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `events_results`, `serpapi_pagination`

## 119. Facebook Marketplace API
[Official documentation](https://serpapi.com/facebook-marketplace-api) · Engine: `facebook_marketplace`

Inputs: `q`, `location`, `lat`, `lon`, `radius`, `category`, `min_price`, `max_price`, `condition`, `days_since_listed`, `delivery_method`, `availability`, `sort_by`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `organic_results`, `serpapi_pagination`, `relaxed_results`

## 120. Facebook Profile API
[Official documentation](https://serpapi.com/facebook-profile-api) · Engine: `facebook_profile`

Inputs: `profile_id`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `profile_results`

## 121. Flightradar24 Live Flights API
[Official documentation](https://serpapi.com/flightradar24-api) · Engine: `flightradar24`

Inputs: `airport`, `map_bounds`, `flight_number`, `callsign`, `airline`, `registration`, `aircraft_type`, `departure_id`, `arrival_id`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `flights`

## 122. Glassdoor Jobs API
[Official documentation](https://serpapi.com/glassdoor-jobs-api) · Engine: `glassdoor_jobs`

Inputs: `q`, `location`, `radius`, `date_posted`, `job_type`, `seniority_level`, `remote`, `easy_apply`, `min_rating`, `min_salary`, `max_salary`, `employer_id`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `jobs_results`, `serpapi_pagination`

## 123. Glassdoor Companies API
[Official documentation](https://serpapi.com/glassdoor-companies-api) · Engine: `glassdoor_companies`

Inputs: `q`, `location`, `min_rating`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `serpapi_pagination`

## 124. Glassdoor Reviews API
[Official documentation](https://serpapi.com/glassdoor-reviews-api) · Engine: `glassdoor_reviews`

Inputs: `employer_id`*, `location`, `language`, `q`, `sort_by`, `rating`, `employment_status`, `current_employees`, `job_title`, `page`, `num`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `company_information`, `reviews`, `serpapi_pagination`

## 125. Instagram Profile API
[Official documentation](https://serpapi.com/instagram-profile-api) · Engine: `instagram_profile`

Inputs: `profile_id`*, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `profile_results`, `serpapi_pagination`

## 126. Indeed Jobs API
[Official documentation](https://serpapi.com/indeed-jobs-api) · Engine: `indeed_jobs`

Inputs: `q`*, `l`, `radius`, `jt`, `fromage`, `sort`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `jobs_results`, `related_searches`

## 127. Instagram Popular API
[Official documentation](https://serpapi.com/instagram-popular-api) · Engine: `instagram_popular`

Inputs: `keyword`*, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_parameters`, `description`, `popular_results`, `serpapi_pagination`, `related_keywords`, `popular_keywords`

## 128. Meta Ad Library API
[Official documentation](https://serpapi.com/meta-ad-library-api) · Engine: `meta_ad_library`

Inputs: `q`, `page_id`, `country`, `search_type`, `ad_type`, `active_status`, `media_type`, `publisher_platforms`, `content_languages`, `start_date`, `end_date`, `sort_by`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `ads`, `serpapi_pagination`, `advertiser`

## 129. NAPA Auto Parts Search API
[Official documentation](https://serpapi.com/napa-search-api) · Engine: `napa`

Inputs: `q`*, `store_id`, `sort`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `serpapi_pagination`

## 130. Naver Search Engine Results API
[Official documentation](https://serpapi.com/naver-search-api) · Engine: `naver`

Inputs: `query`*, `start`, `page`, `num`, `where`, `sort_by`, `period`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: No standalone example keys extracted; see source.

## 131. Naver AI Mode API
[Official documentation](https://serpapi.com/naver-ai-mode-api) · Engine: `naver_ai_mode`

Inputs: `query`*, `continuable`, `subsequent_request_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `markdown`, `text_blocks`, `disclaimer`, `shopping_results`, `place_results`, `media`, `subsequent_request_token`, `references`, `notice`, `related_questions`

## 132. Naver AI Overview API
[Official documentation](https://serpapi.com/naver-ai-overview-api) · Engine: `naver_ai_overview`

Inputs: `query`, `page_token`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `markdown`, `text_blocks`, `references`, `media`, `related_questions`

## 133. Naver Knowledge iN API
[Official documentation](https://serpapi.com/naver-knowledge-in-api) · Engine: `naver_knowledge_in`

Inputs: `query`*, `period`, `answerer`, `page`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `organic_results`, `serpapi_pagination`, `search_information`, `ads_results`

## 134. Naver Maps API
[Official documentation](https://serpapi.com/naver-maps-api) · Engine: `naver_maps`

Inputs: `query`*, `center`, `sort_by`, `open_state`, `bookable`, `coupon`, `naver_pay`, `wheelchair_accessible`, `check_in_date`, `check_out_date`, `adults`, `children`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_information`, `local_results`, `serpapi_pagination`

## 135. OpenTable Reviews API
[Official documentation](https://serpapi.com/open-table-reviews-api) · Engine: `open_table_reviews`

Inputs: `rid`*, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `reviews_summary`, `reviews`, `serpapi_pagination`, `awards`

## 136. Pinterest Search API
[Official documentation](https://serpapi.com/pinterest-search-api) · Engine: `pinterest`

Inputs: `q`*, `type`, `less_ai`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `related_searches`, `filters`, `pins`, `featured_boards`, `serpapi_pagination`, `boards`, `profiles`, `search_information`, `shopping_results`

## 137. The Home Depot API
[Official documentation](https://serpapi.com/home-depot-search-api) · Engine: `home_depot`

Inputs: `q`*, `country`, `hd_sort`, `hd_filter_tokens`, `delivery_zip`, `store_id`, `store`, `sort`, `filter`, `lowerbound`, `upperbound`, `minmax`, `nao`, `page`, `ps`, `pagesize`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `taxonomy`, `products`, `filters`, `related_products`, `pagination`, `serpapi_pagination`, `related`

## 138. The Home Depot Product API
[Official documentation](https://serpapi.com/home-depot-product) · Engine: `home_depot_product`

Inputs: `product_id`, `store_sku`, `delivery_zip`, `store_id`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `product_results`

## 139. The Home Depot Product Reviews API
[Official documentation](https://serpapi.com/home-depot-product-reviews) · Engine: `home_depot_product_reviews`

Inputs: `product_id`*, `term`, `rating`, `sort_by`, `verified_purchases`, `start`, `pagesize`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `total_review`, `overall_rating`, `total_positive_recommendation`, `total_negative_recommendation`, `ratings`, `reviews`, `serpapi_pagination`

## 140. Target Search API
[Official documentation](https://serpapi.com/target-search-api) · Engine: `target`

Inputs: `q`*, `store_id`, `delivery_zip`, `sort`, `facet`, `category_id`, `min_price`, `max_price`, `spelling`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`, `include_filters`

Example output keys: `organic_results`, `popular_filters`, `applied_filters`, `filters`, `search_information`, `serpapi_pagination`

## 141. TikTok Discover API
[Official documentation](https://serpapi.com/tiktok-discover-api) · Engine: `tiktok_discover`

Inputs: `q`*, `gl`, `start`, `num`, `session_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `video_results`, `serpapi_pagination`

## 142. TikTok Shop API
[Official documentation](https://serpapi.com/tiktok-shop-api) · Engine: `tiktok_shop`

Inputs: `q`*, `sort`, `deals`, `category_id`, `color_id`, `min_price`, `max_price`, `rating`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `organic_results`, `filters`, `serpapi_pagination`, `search_information`

## 143. Trader Joe's Search API
[Official documentation](https://serpapi.com/trader-joes-search-api) · Engine: `trader_joes`

Inputs: `q`*, `store_id`, `category_id`, `characteristics`, `tags`, `new_products`, `sort_by`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_information`, `organic_results`, `search_parameters`, `serpapi_pagination`

## 144. Trader Joe's Product API
[Official documentation](https://serpapi.com/trader-joes-product-api) · Engine: `trader_joes_product`

Inputs: `product_id`*, `store_id`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `product_results`

## 145. Tripadvisor Search Engine Results API
[Official documentation](https://serpapi.com/tripadvisor-search-api) · Engine: `tripadvisor`

Inputs: `q`*, `lat`, `lon`, `tripadvisor_domain`, `ssrc`, `offset`, `limit`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `places`, `serpapi_pagination`, `forums`, `locations`

## 146. Tripadvisor Place API
[Official documentation](https://serpapi.com/tripadvisor-place-api) · Engine: `tripadvisor_place`

Inputs: `place_id`*, `tripadvisor_domain`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `place_result`

## 147. Tripadvisor Reviews API
[Official documentation](https://serpapi.com/tripadvisor-reviews-api) · Engine: `tripadvisor_reviews`

Inputs: `place_id`*, `tripadvisor_domain`, `language`, `sort_by`, `rating`, `month`, `type_of_visit`, `offset`, `limit`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `reviews`, `serpapi_pagination`

## 148. Walmart Search Engine Results API
[Official documentation](https://serpapi.com/walmart-search-api) · Engine: `walmart`

Inputs: `query`*, `walmart_domain`, `sort`, `soft_sort`, `cat_id`, `facet`, `store_id`, `min_price`, `max_price`, `spelling`, `nd_en`, `page`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`, `include_filters`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `filters`, `related_queries`, `pagination`, `serpapi_pagination`

## 149. Walmart Product API
[Official documentation](https://serpapi.com/walmart-product-api) · Engine: `walmart_product`

Inputs: `product_id`*, `store_id`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `product_result`, `reviews_results`

## 150. Walmart Product Sellers API
[Official documentation](https://serpapi.com/walmart-product-sellers-api) · Engine: `walmart_product_sellers`

Inputs: `product_id`*, `store_id`*, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `sellers_results`

## 151. Walmart Reviews API
[Official documentation](https://serpapi.com/walmart-product-reviews-api) · Engine: `walmart_product_reviews`

Inputs: `product_id`*, `rating`, `sort`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `product`, `overall_rating`, `total_count`, `ratings`, `top_positive`, `top_negative`, `reviews`, `pagination`, `serpapi_pagination`

## 152. Walmart Seller API
[Official documentation](https://serpapi.com/walmart-seller-api) · Engine: `walmart_seller`

Inputs: `catalog_seller_id`*, `sort`, `facet`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`, `include_filters`

Example output keys: `search_information`, `seller_results`, `organic_results`, `pagination`, `serpapi_pagination`, `error`, `filters`

## 153. Yahoo! Search Engine Results API
[Official documentation](https://serpapi.com/yahoo-search-api) · Engine: `yahoo`

Inputs: `p`*, `yahoo_domain`, `vc`, `vl`, `b`, `vm`, `vs`, `vf`, `fr2`, `d`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `ads_results`, `pagination`, `serpapi_pagination`, `related_searches`

## 154. Yahoo! Finance API
[Official documentation](https://serpapi.com/yahoo-finance-api) · Engine: `yahoo_finance`

Inputs: `q`*, `yahoo_domain`, `window`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `summary`, `graph`, `stats`, `company_overview`, `performance_overview`, `analyst_insights`, `earnings`, `key_statistics`, `people_also_watch`, `trending_tickers`, `market_summary`, `suggestions`

## 155. Yahoo! Videos API
[Official documentation](https://serpapi.com/yahoo-videos-api) · Engine: `yahoo_videos`

Inputs: `p`*, `yahoo_domain`, `durs`, `vage`, `vres`, `vsite`, `b`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `videos_results`, `serpapi_pagination`, `shopping_results`, `related_searches`, `ads`

## 156. Yahoo! Images API
[Official documentation](https://serpapi.com/yahoo-images-api) · Engine: `yahoo_images`

Inputs: `p`*, `yahoo_domain`, `imgsz`, `imgc`, `imgty`, `imga`, `imgf`, `imgt`, `imgl`, `b`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `images_results`, `related_searches`, `suggested_searches`, `shopping_results`, `serpapi_pagination`

## 157. Yahoo! Trends API
[Official documentation](https://serpapi.com/yahoo-trends-api) · Engine: `yahoo_trends`

Inputs: `next_page_token`, `full_video_links`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `trending_topics`, `categories`, `milestones`, `serpapi_pagination`

## 158. Yandex Search Engine Results API
[Official documentation](https://serpapi.com/yandex-search-api) · Engine: `yandex`

Inputs: `text`*, `yandex_domain`, `lang`, `lr`, `family_mode`, `fix_typo`, `groups_on_page`, `sort_mode`, `period`, `p`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `pagination`, `serpapi_pagination`, `ads_results`, `knowledge_graph`, `inline_images`, `more_images_link`, `more_images_serpapi_link`, `inline_videos`, `more_videos_link`, `more_videos_serpapi_link`

## 159. Yandex Images API
[Official documentation](https://serpapi.com/yandex-images-api) · Engine: `yandex_images`

Inputs: `text`*, `yandex_domain`, `width`, `height`, `file_type`, `color`, `orientation`, `image_type`, `site`, `recent`, `family_mode`, `url`, `crop`, `crop_id`, `tab`, `p`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `images_results`, `store_offers`, `serpapi_pagination`, `suggested_searches`

## 160. Yandex Videos API
[Official documentation](https://serpapi.com/yandex-videos-api) · Engine: `yandex_videos`

Inputs: `text`*, `yandex_domain`, `duration`, `hd`, `within`, `p`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `videos_results`, `serpapi_pagination`

## 161. Yelp Search Engine Results API
[Official documentation](https://serpapi.com/yelp-search-api) · Engine: `yelp`

Inputs: `find_desc`, `find_loc`*, `yelp_domain`, `sortby`, `start`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `organic_results`, `pagination`, `serpapi_pagination`

## 162. Yelp Place Scraper API
[Official documentation](https://serpapi.com/yelp-place) · Engine: `yelp_place`

Inputs: `place_id`*, `yelp_domain`, `business_alert`, `full_menu`, `menu_name`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `place_results`

## 163. Yelp Reviews API
[Official documentation](https://serpapi.com/yelp-reviews-api) · Engine: `yelp_reviews`

Inputs: `place_id`*, `yelp_domain`, `hl`, `q`, `sortby`, `rating`, `not_recommended`, `start`, `num`, `not_recommended_start`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `review_languages`, `reviews`, `serpapi_pagination`

## 164. YouTube Search Engine Results API
[Official documentation](https://serpapi.com/youtube-search-api) · Engine: `youtube`

Inputs: `search_query`*, `gl`, `hl`, `sp`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `ads_results`, `movie_results`, `video_results`, `channel_results`, `searches_related_to_star_wars`, `pagination`, `serpapi_pagination`

## 165. YouTube Video API
[Official documentation](https://serpapi.com/youtube-video-api) · Engine: `youtube_video`

Inputs: `v`, `gl`, `hl`, `next_page_token`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `video_id`, `title`, `thumbnail`, `channel`, `views`, `extracted_views`, `likes`, `extracted_likes`, `published_date`, `length`, `length_seconds`, `category`, `keywords`, `description`, `music`, `chapters`, `related_videos`, `related_videos_next_page_token`, `end_screen_videos`, `comment_count`, `extracted_comment_count`, `comments_next_page_token`, `comments_sorting_token`, `transcript`, `live`, `made_with_ai`, `most_replayed`, `members_only`, `additional_info`, `age_restricted`, `key_moments`, `shopping_results`, `comments`, `comment_parent_id`, `replies`, `replies_next_page_token`

## 166. YouTube Video Transcript API
[Official documentation](https://serpapi.com/youtube-video-transcript) · Engine: `youtube_video_transcript`

Inputs: `v`*, `language_code`, `title`, `type`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `transcript`, `chapters`, `available_transcripts`

## 167. Extract API
[Official documentation](https://serpapi.com/extract-api) · Engine: `extract`

Inputs: `url`*, `mode`, `max_pages`, `max_depth`, `include_subdomains`, `include_sitemap`, `prefetch_delay`, `timeout`, `include_tags`, `exclude_tags`, `include_markdown`, `engine`*, `device`, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `page_information`, `markdown`, `inline_links`, `urls`, `pages`

## 168. YouTube Channel API
[Official documentation](https://serpapi.com/youtube-channel-api) · Engine: `youtube_channel`

Inputs: `channel_id`, `gl`, `hl`, `next_page_token`, `tab`, `sort`, `search_query`, `about`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `channel_results`, `videos_results`, `filters`, `serpapi_pagination`, `trailer`, `featured_channels`, `shorts_results`, `streams_results`, `podcasts_results`, `playlists_results`, `posts_results`, `search_results`

## 169. YouTube Music API
[Official documentation](https://serpapi.com/youtube-music-api) · Engine: `youtube_music`

Inputs: `q`*, `gl`, `hl`, `next_page_token`, `filter`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `top_result`, `organic_results`, `serpapi_pagination`

## 170. Zillow Search API
[Official documentation](https://serpapi.com/zillow-search-api) · Engine: `zillow`

Inputs: `region_id`, `map_bounds`, `status_type`, `price`, `beds`, `baths`, `home_type`, `sqft`, `year_built`, `has_garage`, `single_story`, `age_55_plus`, `amenities`, `view`, `price_reduction`, `time_on_zillow`, `keywords`, `hoa_max`, `parking_spots`, `lot_size`, `basement`, `listing_type`, `listing_status`, `tours`, `space`, `move_in_date`, `hide_no_date_listings`, `pets`, `listing_features`, `short_term_lease`, `sort_by`, `page`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `pagination`, `serpapi_pagination`, `relaxed_results`

## 171. Supported Locations API
[Official documentation](https://serpapi.com/locations-api) · Engine: `result feature / auxiliary / see source`

Inputs: `q`, `limit`

Example output keys: No standalone example keys extracted; see source.

## 172. Google Local Pack API
[Official documentation](https://serpapi.com/local-pack) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `local_map`, `local_results`

## 173. Google Images Results API
[Official documentation](https://serpapi.com/images-results) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `shopping_results`, `images_results`, `suggested_searches`, `related_searches`

## 174. Google Local "Places" Results API
[Official documentation](https://serpapi.com/local-results) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `local_results`, `local_map`

## 175. Google Video Results API
[Official documentation](https://serpapi.com/videos-results) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `video_results`

## 176. Google News Results API
[Official documentation](https://serpapi.com/news-results) · Engine: `result feature / auxiliary / see source`

Inputs: `tbm`*

Example output keys: `people_also_search_for`, `news_results`, `top_news`, `search_parameters`, `search_information`

## 177. Google Shopping Results API
[Official documentation](https://serpapi.com/shopping-results) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `shopping_results`

## 178. Search Archive API
[Official documentation](https://serpapi.com/search-archive-api) · Engine: `result feature / auxiliary / see source`

Inputs: `search_id`*, `api_key`*, `output`

Example output keys: No standalone example keys extracted; see source.

## 179. Google Direct Answer Box API
[Official documentation](https://serpapi.com/direct-answer-box-api) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `answer_box`, `answer_box_list`

## 180. Google Lens About This Image API
[Official documentation](https://serpapi.com/google-lens-about-this-image-api) · Engine: `result feature / auxiliary / see source`

Inputs: `type`*

Example output keys: `about_this_image`

## 181. Google Lens Exact Matches API
[Official documentation](https://serpapi.com/google-lens-exact-matches-api) · Engine: `result feature / auxiliary / see source`

Inputs: `type`*

Example output keys: `exact_matches`

## 182. Google Lens Products API
[Official documentation](https://serpapi.com/google-lens-products-api) · Engine: `result feature / auxiliary / see source`

Inputs: `type`*

Example output keys: `visual_matches`, `related_content`

## 183. Google Lens Visual Matches API
[Official documentation](https://serpapi.com/google-lens-visual-matches-api) · Engine: `result feature / auxiliary / see source`

Inputs: `type`*

Example output keys: `visual_matches`

## 184. Naver Images API
[Official documentation](https://serpapi.com/naver-images-api) · Engine: `result feature / auxiliary / see source`

Inputs: `where`*

Example output keys: No standalone example keys extracted; see source.

## 185. Search Index
[Official documentation](https://serpapi.com/search-index-api) · Engine: `search_index`

Inputs: `q`*, `num`, `start`, `safe`, `mode`, `type`, `ll`, `radius`, `product_source`, `as_ylo`, `as_yhi`, `gl`, `hl`, `engine`*, `no_cache`, `async`, `zero_trace`, `api_key`*, `output`, `json_restrictor`

Example output keys: `search_metadata`, `search_parameters`, `search_information`, `organic_results`, `related_searches`, `serpapi_pagination`, `video_results`, `publication_results`, `place_results`, `product_results`

## 186. Yandex Reverse Image API
[Official documentation](https://serpapi.com/yandex-reverse-image-api) · Engine: `result feature / auxiliary / see source`

Inputs: `url`*, `crop`, `crop_id`, `tab`

Example output keys: `search_metadata`, `search_parameters`, `image_preview`, `image_results`, `image_sizes`, `shopping_results`, `image_tags`, `similar_images`, `image_sizes_message`, `knowledge_graph`, `images_results`

## 187. Account API
[Official documentation](https://serpapi.com/account-api) · Engine: `result feature / auxiliary / see source`

Inputs: `api_key`*

Example output keys: `account_id`, `api_key`, `account_email`, `account_status`, `plan_id`, `plan_name`, `plan_monthly_price`, `plan_renewal_date`, `searches_per_month`, `plan_searches_left`, `extra_credits`, `total_searches_left`, `this_month_usage`, `this_hour_searches`, `last_hour_searches`, `account_rate_limit_per_hour`

## 188. Image API
[Official documentation](https://serpapi.com/image-api) · Engine: `result feature / auxiliary / see source`

Inputs: `image`*

Example output keys: `message`, `image_id`, `error`

## 189. Pixel Position
[Official documentation](https://serpapi.com/pixel-position-api) · Engine: `result feature / auxiliary / see source`

Inputs: See source; no standalone parameter block extracted.

Example output keys: `search_metadata`, `pixel_position_information`, `local_results`, `organic_results`, `popular_destinations`, `short_videos`, `ads`
