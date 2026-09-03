# PostShiba

WordPress plugin that sends `wp_mail` through PostShiba.

Not on WordPress.org yet.

## Installation

Clone [postshiba/postshiba-wordpress](https://github.com/postshiba/postshiba-wordpress) into `wp-content/plugins/postshiba` and activate the plugin.

```sh
git clone https://github.com/postshiba/postshiba-wordpress wp-content/plugins/postshiba
```

Open pull requests on [postshiba/sdks](https://github.com/postshiba/sdks).

## How It Works

The plugin hooks `pre_wp_mail`. After you set an API key and from address under **Settings → PostShiba**, WordPress mail posts to `/api/v1/emails`. WooCommerce and other plugins that call `wp_mail` go through the same hook. There is no WooCommerce module.

These constants override the saved options when they are defined: `POSTSHIBA_API_KEY`, `POSTSHIBA_FROM_EMAIL`, `POSTSHIBA_FROM_NAME`, `POSTSHIBA_BASE_URL`, `POSTSHIBA_ENABLED`.

## Send an email

```php
wp_mail(
  "you@example.com",
  "PostShiba test",
  "hello from PostShiba"
);
```

## Settings

Open **Settings → PostShiba**. Set the API key, from email, optional from name, and optional base URL. The default base URL is `https://app.postshiba.com`. Use **Send test email** to mail the current user.

## Errors

A failed send returns `false` from `wp_mail`. The API body fields are `error`, `field`, and `message`.

## Contributing

```sh
composer test
```

Tests mock HTTP. They do not call production.
