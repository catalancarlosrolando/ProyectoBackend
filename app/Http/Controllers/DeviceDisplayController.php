<?php

namespace App\Http\Controllers;

use App\Models\Device;
use Illuminate\Http\Response;

/**
 * Renderiza la vista de reproduccion para dispositivos.
 */
class DeviceDisplayController extends Controller
{
    /**
     * GET /device/{uid}
     */
    public function show(string $uid): Response
    {
        $device = Device::where('uid', $uid)->first();

        if (!$device) {
            return response($this->renderInactivePage('Dispositivo no encontrado', 'No pudimos identificar este dispositivo. Verifica el UID o contacta con el administrador.', $uid), 404)
                ->header('Content-Type', 'text/html; charset=UTF-8');
        }

        return response(
            file_get_contents(public_path('frontend/device-player.html')),
            200,
            ['Content-Type' => 'text/html; charset=UTF-8']
        );
    }

    private function renderInactivePage(string $title, string $message, string $uid): string
    {
        return '<!DOCTYPE html>'
            . '<html lang="es">'
            . '<head>'
            . '<meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
            . '<title>Difexa - Estado del dispositivo</title>'
            . '<link rel="preconnect" href="https://fonts.googleapis.com">'
            . '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            . '<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">'
            . '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,200..700,0..1,-50..200" rel="stylesheet">'
            . '<style>'
            . ':root{color-scheme:dark;--bg:#07111f;--panel:rgba(11,20,36,.82);--panel-2:rgba(16,27,47,.92);--text:#edf4ff;--muted:#9fb2cc;--accent:#ffb84d;--accent-2:#7dd3fc;--border:rgba(255,255,255,.10)}'
            . 'html,body{height:100%;margin:0;font-family:Nunito,system-ui,sans-serif;background:radial-gradient(circle at top,#16345d 0,#0a1426 45%,#050a12 100%);color:var(--text)}'
            . 'body{display:grid;place-items:center;padding:24px;box-sizing:border-box}'
            . '.shell{width:min(920px,100%);position:relative;overflow:hidden;border:1px solid var(--border);border-radius:28px;background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));box-shadow:0 25px 80px rgba(0,0,0,.45);backdrop-filter:blur(18px)}'
            . '.shell:before,.shell:after{content:"";position:absolute;border-radius:999px;filter:blur(12px);opacity:.65;pointer-events:none}'
            . '.shell:before{width:280px;height:280px;background:rgba(125,211,252,.22);top:-110px;right:-70px}'
            . '.shell:after{width:220px;height:220px;background:rgba(255,184,77,.20);bottom:-80px;left:-60px}'
            . '.content{position:relative;z-index:1;display:grid;grid-template-columns:1.1fr .9fr;gap:0;min-height:540px}'
            . '.left{padding:48px 44px 40px;display:flex;flex-direction:column;justify-content:center}'
            . '.badge{display:inline-flex;align-items:center;gap:10px;width:max-content;padding:10px 14px;border-radius:999px;background:rgba(255,184,77,.14);color:#ffdca3;border:1px solid rgba(255,184,77,.22);font-weight:700;letter-spacing:.02em}'
            . '.badge i{width:10px;height:10px;border-radius:50%;background:var(--accent);display:inline-block;box-shadow:0 0 0 6px rgba(255,184,77,.12)}'
            . 'h1{margin:22px 0 12px;font-size:clamp(2rem,5vw,4rem);line-height:1.04;font-weight:800;letter-spacing:-.03em}'
            . '.lead{margin:0 0 24px;color:var(--muted);font-size:1.08rem;line-height:1.7;max-width:56ch}'
            . '.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:6px}'
            . '.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:14px 18px;border-radius:16px;font-weight:800;text-decoration:none;border:1px solid transparent;transition:transform .18s ease,opacity .18s ease}'
            . '.btn:hover{transform:translateY(-1px)}'
            . '.btn--primary{background:linear-gradient(135deg,#ffb84d,#ff8f3d);color:#111827;box-shadow:0 14px 30px rgba(255,143,61,.26)}'
            . '.btn--ghost{background:rgba(255,255,255,.05);color:var(--text);border-color:var(--border)}'
            . '.meta{margin-top:28px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}'
            . '.card{padding:16px 18px;border-radius:20px;background:var(--panel);border:1px solid var(--border)}'
            . '.card span{display:block;color:var(--muted);font-size:.88rem;margin-bottom:8px}'
            . '.card strong{font-size:1rem;line-height:1.4}'
            . '.right{padding:26px;display:flex;align-items:stretch}'
            . '.illustration{width:100%;border-radius:26px;background:linear-gradient(180deg,rgba(10,16,28,.35),rgba(10,16,28,.72));border:1px solid var(--border);display:flex;flex-direction:column;justify-content:center;align-items:center;padding:32px;text-align:center;min-height:100%}'
            . '.icon{width:128px;height:128px;border-radius:32px;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(255,255,255,.18),rgba(255,255,255,.05));border:1px solid var(--border);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}'
            . '.icon span{font-size:4rem;color:#ffcc80}'
            . '.illustration h2{margin:20px 0 8px;font-size:1.35rem}'
            . '.illustration p{margin:0;color:var(--muted);line-height:1.7;max-width:30ch}'
            . '.footer{padding:0 44px 40px;color:#85a0bf;font-size:.92rem}'
            . '@media (max-width: 820px){.content{grid-template-columns:1fr}.left{padding:34px 22px 22px}.right{padding:0 22px 22px}.footer{padding:0 22px 26px}.meta{grid-template-columns:1fr}}'
            . '</style>'
            . '</head>'
            . '<body>'
            . '<main class="shell">'
            . '<div class="content">'
            . '<section class="left">'
            . '<div class="badge"><i></i> Estado del dispositivo</div>'
            . '<h1>' . e($title) . '</h1>'
            . '<p class="lead">' . e($message) . '</p>'
            . '<div class="actions">'
            . '<a class="btn btn--primary" href="/frontend">Ir al panel principal</a>'
            . '<a class="btn btn--ghost" href="mailto:soporte@difexa.local">Contactar soporte</a>'
            . '</div>'
            . '<div class="meta">'
            . '<div class="card"><span>Qué pasó</span><strong>El equipo está registrado, pero no está habilitado para mostrar publicaciones.</strong></div>'
            . '<div class="card"><span>Qué hacer</span><strong>Un administrador debe reactivarlo para que vuelva a sincronizar contenido.</strong></div>'
            . '</div>'
            . '</section>'
            . '<aside class="right">'
            . '<div class="illustration">'
            . '<div class="icon"><span class="material-symbols-rounded">tv_off</span></div>'
            . '<h2>Dispositivo pausado</h2>'
            . '<p>Este reproductor no mostrará contenido hasta que vuelva a estar activo.</p>'
            . '</div>'
            . '</aside>'
            . '</div>'
            . '<div class="footer">UID: ' . e($uid) . '</div>'
            . '</main>'
            . '</body>'
            . '</html>';
    }
}
