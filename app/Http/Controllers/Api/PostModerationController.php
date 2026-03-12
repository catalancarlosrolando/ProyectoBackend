<?php

namespace App\Http\Controllers\Api;

use App\Models\Post;
use App\Models\PostHistory;
use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ModeratePostRequest;
use App\Http\Requests\StopPostRequest;
use App\Notifications\PostModeratedNotification;
use App\Notifications\PostStoppedNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controlador para la moderación de publicaciones.
 *
 * Funcionalidades (H13 + H14):
 * - Listar publicaciones pendientes de moderación
 * - Ver detalle de publicación para revisión
 * - Aprobar o rechazar publicaciones
 * - Detener publicaciones en difusión
 */
class PostModerationController extends Controller
{
    /**
     * Verifica que el usuario tenga rol de moderador o admin.
     */
    private function authorizeModeratorAccess(Request $request): ?JsonResponse
    {
        if (!$request->user()->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo moderadores y administradores pueden acceder a la moderación.',
            ], 403);
        }

        return null;
    }

    // ════════════════════════════════════════════════════════════
    // MODERACIÓN (H13)
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/moderation/posts
     *
     * Listado de publicaciones pendientes de moderación.
     */
    public function pending(Request $request): JsonResponse
    {
        if ($denied = $this->authorizeModeratorAccess($request)) {
            return $denied;
        }

        $posts = Post::where('status', PostStatus::PENDING_REVIEW->value)
            ->with(['user:id,name,first_name,last_name', 'channels:id,name,type', 'medias:id,name,type', 'attachments'])
            ->orderBy('created_at')
            ->paginate(20);

        return response()->json([
            'status'  => 'success',
            'data'    => $posts,
            'message' => 'Publicaciones pendientes de moderación obtenidas correctamente.',
        ]);
    }

    /**
     * GET /api/moderation/posts/{post}
     *
     * Ver contenido completo de una publicación para revisión.
     */
    public function show(Request $request, Post $post): JsonResponse
    {
        if ($denied = $this->authorizeModeratorAccess($request)) {
            return $denied;
        }

        $post->load(['user:id,name,first_name,last_name', 'channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Detalle de publicación para moderación obtenido correctamente.',
        ]);
    }

    /**
     * POST /api/moderation/posts/{post}/approve
     *
     * Aprobar una publicación pendiente de revisión.
     * - Con scheduled_at → pasa a "scheduled"
     * - Sin scheduled_at → pasa a "published" con published_at = now()
     */
    public function approve(Request $request, Post $post): JsonResponse
    {
        if ($denied = $this->authorizeModeratorAccess($request)) {
            return $denied;
        }

        if ($post->status !== PostStatus::PENDING_REVIEW) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden aprobar publicaciones en estado pendiente de revisión.',
            ], 422);
        }

        $user     = $request->user();
        $hasSchedule = !is_null($post->scheduled_at);

        if ($hasSchedule) {
            $newStatus = PostStatus::SCHEDULED;
            $post->update(['status' => $newStatus->value]);
        } else {
            $newStatus = PostStatus::PUBLISHED;
            $post->update([
                'status'       => $newStatus->value,
                'published_at' => now(),
            ]);
        }

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_MODERATION_APPROVED,
            changes: ['status' => ['old' => PostStatus::PENDING_REVIEW->value, 'new' => $newStatus->value]],
            snapshot: PostHistory::takeSnapshot($post),
            comment: $request->input('comments'),
            request: $request,
        );

        // Notificar al publicador
        $post->user->notify(new PostModeratedNotification(
            post: $post,
            decision: 'approved',
            moderatorName: $user->name,
            comments: $request->input('comments'),
        ));

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments', 'user:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => $hasSchedule
                ? 'Publicación aprobada y programada correctamente.'
                : 'Publicación aprobada e iniciada para difusión.',
        ]);
    }

    /**
     * POST /api/moderation/posts/{post}/reject
     *
     * Rechazar una publicación con comentarios obligatorios.
     * La publicación vuelve a estado "draft".
     */
    public function reject(ModeratePostRequest $request, Post $post): JsonResponse
    {
        if ($denied = $this->authorizeModeratorAccess($request)) {
            return $denied;
        }

        if ($post->status !== PostStatus::PENDING_REVIEW) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden rechazar publicaciones en estado pendiente de revisión.',
            ], 422);
        }

        $user     = $request->user();
        $comments = $request->input('moderator_comments');

        $post->update([
            'status'             => PostStatus::DRAFT->value,
            'moderator_comments' => $comments,
        ]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_MODERATION_REJECTED,
            changes: ['status' => ['old' => PostStatus::PENDING_REVIEW->value, 'new' => PostStatus::DRAFT->value]],
            snapshot: PostHistory::takeSnapshot($post),
            comment: $comments,
            request: $request,
        );

        // Notificar al publicador
        $post->user->notify(new PostModeratedNotification(
            post: $post,
            decision: 'rejected',
            moderatorName: $user->name,
            comments: $comments,
        ));

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación rechazada. El publicador ha sido notificado.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // DETENCIÓN (H14)
    // ════════════════════════════════════════════════════════════

    /**
     * POST /api/moderation/posts/{post}/stop
     *
     * Detener una publicación en estado "published".
     * Acceso: moderadores/admin y el publicador propietario.
     */
    public function stop(StopPostRequest $request, Post $post): JsonResponse
    {
        $user = $request->user();

        // Verificar acceso: propietario o moderador/admin
        $isOwner      = $post->user_id === $user->id;
        $isPrivileged = $user->hasRole(['moderador', 'admin']);

        if (!$isOwner && !$isPrivileged) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para detener esta publicación.',
            ], 403);
        }

        if ($post->status !== PostStatus::PUBLISHED) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden detener publicaciones en estado publicado.',
            ], 422);
        }

        $reason = $request->input('reason');

        $post->update([
            'status' => PostStatus::DRAFT->value,
        ]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_STOPPED,
            changes: ['status' => ['old' => PostStatus::PUBLISHED->value, 'new' => PostStatus::DRAFT->value]],
            snapshot: PostHistory::takeSnapshot($post),
            comment: $reason,
            request: $request,
        );

        // Notificar al publicador (si fue detenida por moderador/admin)
        if (!$isOwner) {
            $post->user->notify(new PostStoppedNotification(
                post: $post,
                stoppedByName: $user->name,
                reason: $reason,
            ));
        }

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación detenida correctamente. La publicación se encuentra en estado borrador para correcciones.',
        ]);
    }
}
