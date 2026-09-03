<?php

namespace PostShiba;

class Plugin
{
    public static function boot(): void
    {
        add_filter('pre_wp_mail', [self::class, 'preWpMail'], 10, 2);
        Settings::register();
    }

    /**
     * @param mixed $shortCircuit
     * @param array<string, mixed> $atts
     */
    public static function preWpMail(mixed $shortCircuit, array $atts): mixed
    {
        $settings = Settings::get();
        if (!$settings['enabled'] || $settings['api_key'] === '') {
            return null;
        }

        try {
            $clusterId = $settings['cluster_id'] !== '' ? $settings['cluster_id'] : null;
            (new Client($settings['api_key'], $settings['base_url']))->send(
                Mail::payload($atts, $settings),
                $clusterId,
            );

            return true;
        } catch (Error) {
            return false;
        }
    }
}
