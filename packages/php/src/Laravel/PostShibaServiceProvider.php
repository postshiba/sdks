<?php

namespace PostShiba\Laravel;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use PostShiba\PostShiba;

class PostShibaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(PostShiba::class, function ($app) {
            $config = $app['config']->get('services.postshiba', []);

            return new PostShiba(
                $config['key'] ?? $config['api_key'] ?? '',
                $config['base_url'] ?? null,
                $config['team_id'] ?? null,
            );
        });
    }

    public function boot(): void
    {
        Mail::extend('postshiba', function () {
            return new Transport($this->app->make(PostShiba::class));
        });
    }
}
