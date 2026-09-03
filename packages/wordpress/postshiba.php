<?php
/**
 * Plugin Name: PostShiba
 * Description: Send WordPress mail through PostShiba.
 * Version: 0.1.0
 * Requires at least: 6.0
 * Requires PHP: 8.1
 * License: MIT
 * License URI: https://opensource.org/licenses/MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

require_once __DIR__.'/src/Error.php';
require_once __DIR__.'/src/Mail.php';
require_once __DIR__.'/src/Client.php';
require_once __DIR__.'/src/Settings.php';
require_once __DIR__.'/src/Plugin.php';

PostShiba\Plugin::boot();
