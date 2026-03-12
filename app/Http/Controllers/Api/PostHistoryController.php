<?php

namespace App\Http\Controllers\Api;

use App\Models\Post;
use App\Models\PostHistory;
use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Controlador para el historial de cambios de publicaciones.
 *
 * Funcionalidades (H10 - Historial):
 * - Ver historial cronológico con filtros
 * - Comparar dos versiones (diff)
 * - Restaurar versión anterior
 * - Exportar historial en CSV
 */
class PostHistoryController extends Controller
{
    /**
     * GET /api/posts/{post}/history
     *
     * Listado cronológico del historial de una publicación.
     * Filtros: action, user_id, date_from, date_to
     */
    public function index(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        // Publicador: solo ve historial de sus propias publicaciones
        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para ver el historial de esta publicación.',
            ], 403);
        }

        $query = $post->histories()->with('user:id,name,first_name,last_name');

        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('created_at', '>=', $request->input('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('created_at', '<=', $request->input('date_to'));
        }

        $history = $query->orderByDesc('created_at')->paginate(20);

        return response()->json([
            'status'  => 'success',
            'data'    => $history,
            'message' => 'Historial obtenido correctamente.',
        ]);
    }

    /**
     * GET /api/posts/{post}/history/compare?version_a={id}&version_b={id}
     *
     * Comparar los snapshots de dos entradas del historial.
     */
    public function compare(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para ver el historial de esta publicación.',
            ], 403);
        }

        $request->validate([
            'version_a' => 'required|integer|exists:post_histories,id',
            'version_b' => 'required|integer|exists:post_histories,id',
        ]);

        $versionA = PostHistory::where('post_id', $post->id)->findOrFail($request->input('version_a'));
        $versionB = PostHistory::where('post_id', $post->id)->findOrFail($request->input('version_b'));

        if (!$versionA->snapshot || !$versionB->snapshot) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Una o ambas versiones no tienen snapshot disponible para comparación.',
            ], 422);
        }

        $diff = [];
        $allKeys = array_unique(array_merge(
            array_keys($versionA->snapshot),
            array_keys($versionB->snapshot),
        ));

        foreach ($allKeys as $key) {
            $valueA = $versionA->snapshot[$key] ?? null;
            $valueB = $versionB->snapshot[$key] ?? null;

            if ($valueA !== $valueB) {
                $diff[$key] = [
                    'version_a' => $valueA,
                    'version_b' => $valueB,
                ];
            }
        }

        return response()->json([
            'status'  => 'success',
            'data'    => [
                'version_a' => [
                    'id'         => $versionA->id,
                    'action'     => $versionA->action,
                    'created_at' => $versionA->created_at,
                    'snapshot'   => $versionA->snapshot,
                ],
                'version_b' => [
                    'id'         => $versionB->id,
                    'action'     => $versionB->action,
                    'created_at' => $versionB->created_at,
                    'snapshot'   => $versionB->snapshot,
                ],
                'diff' => $diff,
            ],
            'message' => 'Comparación generada correctamente.',
        ]);
    }

    /**
     * POST /api/posts/{post}/history/{history}/restore
     *
     * Restaurar una versión anterior desde su snapshot.
     * - Publicador: solo en estado "draft" y sus propias publicaciones.
     * - Moderador/Admin: cualquier estado (si "scheduled" requiere confirmación).
     */
    public function restore(Request $request, Post $post, PostHistory $history): JsonResponse
    {
        $user = $request->user();

        // Verificar que el historial pertenece al post
        if ($history->post_id !== $post->id) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'La entrada de historial no pertenece a esta publicación.',
            ], 422);
        }

        if (!$history->snapshot) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Esta versión no tiene snapshot disponible para restaurar.',
            ], 422);
        }

        // Verificar permisos
        $isOwner    = $post->user_id === $user->id;
        $isPrivileged = $user->hasRole(['moderador', 'admin']);

        if (!$isOwner && !$isPrivileged) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para restaurar versiones de esta publicación.',
            ], 403);
        }

        // Publicador solo puede restaurar en estado draft
        if ($isOwner && !$isPrivileged && $post->status !== PostStatus::DRAFT) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo puede restaurar versiones de publicaciones en estado borrador.',
            ], 422);
        }

        // Si es scheduled y privilegiado, requiere confirmación
        if ($post->status === PostStatus::SCHEDULED && $isPrivileged) {
            if (!$request->boolean('confirm')) {
                return response()->json([
                    'status'  => 'error',
                    'data'    => null,
                    'message' => 'La publicación está programada. Debe confirmar la restauración (requiere nueva moderación).',
                ], 422);
            }
        }

        $snapshot = $history->snapshot;

        // Restaurar campos del post
        $post->update([
            'name'               => $snapshot['name'] ?? $post->name,
            'content'            => $snapshot['content'] ?? $post->content,
            'type'               => $snapshot['type'] ?? $post->type,
            'status'             => PostStatus::DRAFT->value, // Siempre vuelve a draft
            'moderator_comments' => $snapshot['moderator_comments'] ?? null,
            'scheduled_at'       => $snapshot['scheduled_at'] ?? null,
        ]);

        // Restaurar relaciones
        if (isset($snapshot['channel_ids'])) {
            $post->channels()->sync($snapshot['channel_ids']);
        }

        if (isset($snapshot['media_ids'])) {
            $post->medias()->sync($snapshot['media_ids']);
        }

        // Registrar historial
        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_RESTORED_VERSION,
            changes: ['restored_from_history_id' => $history->id],
            snapshot: PostHistory::takeSnapshot($post),
            comment: "Versión restaurada desde historial #{$history->id}",
            request: $request,
        );

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Versión restaurada correctamente. La publicación se encuentra en estado borrador.',
        ]);
    }

    /**
     * GET /api/posts/{post}/history/export?format=csv
     *
     * Exportar el historial de una publicación en formato CSV.
     */
    public function export(Request $request, Post $post): StreamedResponse|JsonResponse
    {
        $user = $request->user();

        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para exportar el historial de esta publicación.',
            ], 403);
        }

        $histories = $post->histories()->with('user:id,name,first_name,last_name')->orderBy('created_at')->get();

        $filename = "historial_publicacion_{$post->id}_" . now()->format('Y-m-d_His') . '.csv';

        return response()->streamDownload(function () use ($histories) {
            $handle = fopen('php://output', 'w');

            // BOM para UTF-8
            fprintf($handle, chr(0xEF) . chr(0xBB) . chr(0xBF));

            // Encabezados
            fputcsv($handle, [
                'ID',
                'Fecha',
                'Usuario',
                'Acción',
                'Comentario',
                'Cambios',
                'IP',
                'User Agent',
            ]);

            foreach ($histories as $entry) {
                fputcsv($handle, [
                    $entry->id,
                    $entry->created_at?->toDateTimeString(),
                    $entry->user?->name ?? 'Sistema',
                    $entry->action,
                    $entry->comment,
                    $entry->changes ? json_encode($entry->changes, JSON_UNESCAPED_UNICODE) : '',
                    $entry->ip_address,
                    $entry->user_agent,
                ]);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
