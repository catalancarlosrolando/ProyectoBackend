<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\DeviceDisplayController;
use App\Http\Controllers\DocumentationController;

Route::get('/demo', function () {
    $reset = request()->query('reset', false);
    return view('demo', [
        'demo' => 'landing-demo',
        'reset' => $reset
    ]);
});


Route::get('/api-client', fn() => view('demo'));

Route::get('/', function () {
    return redirect('/frontend');
});

Route::get('/device/{uid}', [DeviceDisplayController::class, 'show']);

// Ruta para el frontend SPA
Route::get('/frontend', function () {
    return file_get_contents(public_path('frontend/index.html'));
});

// Ruta para previsualizar emails (solo para desarrollo)
if (app()->environment('local')) {
    Route::get('/email-preview/reset-password', function () {
        $user = App\Models\User::first() ?? App\Models\User::factory()->make([
            'name' => 'Usuario Demo',
            'email' => 'demo@ejemplo.com'
        ]);

        $notification = new App\Notifications\ResetPasswordNotification('demo-token-123456');

        return $notification->toMail($user);
    })->name('email.preview.reset');

    Route::get('/email-preview/verify-email', function () {
        $user = App\Models\User::first() ?? App\Models\User::factory()->make([
            'name' => 'Usuario Demo',
            'email' => 'demo@ejemplo.com'
        ]);

        $notification = new App\Notifications\CustomVerifyEmailNotification();

        return $notification->toMail($user);
    })->name('email.preview.verify');
}

// Ruta para el cliente API
// Route::get('/api-client', fn() => view('api-client'))->name('api-client');

// Rutas para documentación
Route::prefix('docs')->group(function () {
    // Índice principal de documentación
    Route::get('/', [DocumentationController::class, 'docsIndex'])->name('docs.index');

    // Documentación principal (3 archivos)
    Route::get('/api-complete', [DocumentationController::class, 'apiCompleteDocs'])->name('docs.api-complete');
    Route::get('/implementation-summary', [DocumentationController::class, 'implementationSummaryDocs'])->name('docs.implementation-summary');
    Route::get('/technical-components', [DocumentationController::class, 'technicalComponentsDocs'])->name('docs.technical-components');

    // Documentación especializada (2 archivos)
    Route::get('/email-customization', [DocumentationController::class, 'emailCustomizationDocs'])->name('docs.email-customization');
    Route::get('/file-upload-examples', [DocumentationController::class, 'fileUploadExamplesDocs'])->name('docs.file-upload-examples');

    // Rutas de compatibilidad con enlaces antiguos (redirects)
    Route::get('/api-client', fn() => redirect()->route('docs.api-complete'))->name('docs.api-client.redirect');
    Route::get('/css-structure', fn() => redirect()->route('docs.technical-components'))->name('docs.css-structure.redirect');
});
