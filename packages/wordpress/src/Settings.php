<?php

namespace PostShiba;

class Settings
{
    public const OPTION = 'postshiba_settings';
    public const DEFAULT_BASE_URL = 'https://app.postshiba.com';

    public static function register(): void
    {
        add_action('admin_menu', [self::class, 'menu']);
        add_action('admin_init', [self::class, 'init']);
    }

    /**
     * @return array{api_key: string, from_email: string, from_name: string, base_url: string, enabled: bool}
     */
    public static function get(): array
    {
        $stored = function_exists('get_option') ? get_option(self::OPTION, []) : [];
        if (!is_array($stored)) {
            $stored = [];
        }

        $apiKey = defined('POSTSHIBA_API_KEY') ? (string) constant('POSTSHIBA_API_KEY') : (string) ($stored['api_key'] ?? '');
        $fromEmail = defined('POSTSHIBA_FROM_EMAIL') ? (string) constant('POSTSHIBA_FROM_EMAIL') : (string) ($stored['from_email'] ?? '');
        $fromName = defined('POSTSHIBA_FROM_NAME') ? (string) constant('POSTSHIBA_FROM_NAME') : (string) ($stored['from_name'] ?? '');
        $baseUrl = defined('POSTSHIBA_BASE_URL') ? (string) constant('POSTSHIBA_BASE_URL') : (string) ($stored['base_url'] ?? '');
        if ($baseUrl === '') {
            $baseUrl = self::DEFAULT_BASE_URL;
        }

        if (defined('POSTSHIBA_ENABLED')) {
            $enabled = (bool) constant('POSTSHIBA_ENABLED');
        } else {
            $explicit = $stored['enabled'] ?? null;
            $enabled = $apiKey !== '' && $explicit !== false && $explicit !== '0' && $explicit !== 0;
        }

        return [
            'api_key' => $apiKey,
            'from_email' => $fromEmail,
            'from_name' => $fromName,
            'base_url' => rtrim($baseUrl, '/'),
            'enabled' => $enabled,
        ];
    }

    public static function menu(): void
    {
        add_options_page('PostShiba', 'PostShiba', 'manage_options', 'postshiba', [self::class, 'render']);
    }

    public static function init(): void
    {
        register_setting('postshiba', self::OPTION, [
            'type' => 'array',
            'sanitize_callback' => [self::class, 'sanitize'],
            'default' => [],
        ]);
    }

    /**
     * @param array<string, mixed> $input
     * @return array{api_key: string, from_email: string, from_name: string, base_url: string, enabled: bool}
     */
    public static function sanitize(array $input): array
    {
        $existing = get_option(self::OPTION, []);
        if (!is_array($existing)) {
            $existing = [];
        }

        $apiKey = sanitize_text_field((string) ($input['api_key'] ?? ''));
        if ($apiKey === '') {
            $apiKey = (string) ($existing['api_key'] ?? '');
        }

        return [
            'api_key' => $apiKey,
            'from_email' => sanitize_email((string) ($input['from_email'] ?? '')),
            'from_name' => sanitize_text_field((string) ($input['from_name'] ?? '')),
            'base_url' => esc_url_raw((string) ($input['base_url'] ?? '')),
            'enabled' => !empty($input['enabled']),
        ];
    }

    public static function render(): void
    {
        if (!current_user_can('manage_options')) {
            return;
        }

        if (!empty($_POST['postshiba_send_test']) && check_admin_referer('postshiba_test')) {
            $user = wp_get_current_user();
            $ok = wp_mail((string) $user->user_email, 'PostShiba test', 'hello from PostShiba');
            add_settings_error(
                'postshiba',
                'postshiba_test',
                $ok ? 'Test email sent to '.$user->user_email.'.' : 'Test email failed.',
                $ok ? 'updated' : 'error',
            );
        }

        $settings = self::get();
        $constants = defined('POSTSHIBA_API_KEY')
            || defined('POSTSHIBA_FROM_EMAIL')
            || defined('POSTSHIBA_FROM_NAME')
            || defined('POSTSHIBA_BASE_URL')
            || defined('POSTSHIBA_ENABLED');

        settings_errors('postshiba');
        ?>
        <div class="wrap">
            <h1>PostShiba</h1>
            <?php if ($constants) : ?>
                <p>Constants in wp-config.php override the matching fields.</p>
            <?php endif; ?>
            <form method="post" action="options.php">
                <?php settings_fields('postshiba'); ?>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="postshiba_api_key">API key</label></th>
                        <td>
                            <input type="password" class="regular-text" id="postshiba_api_key" name="<?php echo esc_attr(self::OPTION); ?>[api_key]" value="" autocomplete="off" />
                            <?php if ($settings['api_key'] !== '') : ?>
                                <p class="description">A key is saved. Leave blank to keep it.</p>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="postshiba_from_email">From email</label></th>
                        <td><input type="email" class="regular-text" id="postshiba_from_email" name="<?php echo esc_attr(self::OPTION); ?>[from_email]" value="<?php echo esc_attr($settings['from_email']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="postshiba_from_name">From name</label></th>
                        <td><input type="text" class="regular-text" id="postshiba_from_name" name="<?php echo esc_attr(self::OPTION); ?>[from_name]" value="<?php echo esc_attr($settings['from_name']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="postshiba_base_url">Base URL</label></th>
                        <td>
                            <input type="url" class="regular-text" id="postshiba_base_url" name="<?php echo esc_attr(self::OPTION); ?>[base_url]" value="<?php echo esc_attr($settings['base_url'] === self::DEFAULT_BASE_URL ? '' : $settings['base_url']); ?>" placeholder="<?php echo esc_attr(self::DEFAULT_BASE_URL); ?>" />
                            <p class="description">Optional. Defaults to <?php echo esc_html(self::DEFAULT_BASE_URL); ?>.</p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Enabled</th>
                        <td>
                            <label>
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION); ?>[enabled]" value="1" <?php checked($settings['enabled']); ?> />
                                Send WordPress mail through PostShiba
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button('Save'); ?>
            </form>
            <form method="post">
                <?php wp_nonce_field('postshiba_test'); ?>
                <?php submit_button('Send test email', 'secondary', 'postshiba_send_test', false); ?>
            </form>
        </div>
        <?php
    }
}
