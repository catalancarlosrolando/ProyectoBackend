<?php

namespace App\Http\Controllers\Api;

use App\Models\Post;
use App\Models\PostHistory;
use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use App\Http\Requests\UpdatePostRequest;
use App\Http\Requests\DeletePostRequest;
use App\Http\Requests\SearchPostRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

/**
 * Controlador para la gestión de publicaciones.
 *
 * Funcionalidades (H09–H12):
 * - Crear, editar, eliminar y archivar publicaciones
 * - Listar con búsqueda y filtrado avanzado
 * - Revertir a borrador y enviar a moderación
 * - Registrar historial de cambios en cada operación
 */
class PostController extends Controller
{
    // ════════════════════════════════════════════════════════════
    // LISTADO CON BÚSQUEDA Y FILTRADO (H09 + H11b)
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/posts
     *
     * Listado de publicaciones con búsqueda y filtrado avanzado.
     * - Publicador: ve solo sus propias publicaciones
     * - Moderador/Admin: ve todas las publicaciones
     */
    public function index(SearchPostRequest $request): JsonResponse
    {
        $user  = $request->user();
        $query = Post::with(['channels:id,name,type', 'medias:id,name,type', 'attachments', 'user:id,name,first_name,last_name']);

        // ── Scope según rol ──
        if (!$user->hasRole(['moderador', 'admin'])) {
            // Publicador: únicamente sus publicaciones.
            $query->where('user_id', $user->id);
        }

        // ── Excluir archivadas del listado activo por defecto ──
        if (!$request->filled('status')) {
            $query->where('status', '!=', PostStatus::ARCHIVED->value);
        }

        // ── Búsqueda por texto libre ──
        if ($request->filled('search')) {
            $term = $request->input('search');
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                  ->orWhere('content', 'like', "%{$term}%")
                  ->orWhere('moderator_comments', 'like', "%{$term}%")
                  ->orWhereHas('user', function ($uq) use ($term) {
                      $uq->where('name', 'like', "%{$term}%")
                          ->orWhere('first_name', 'like', "%{$term}%")
                          ->orWhere('last_name', 'like', "%{$term}%");
                  });
            });
        }

        // ── Filtros ──
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }

        if ($request->filled('channel_ids')) {
            $channelIds = $request->input('channel_ids');
            $query->whereHas('channels', fn ($q) => $q->whereIn('channels.id', $channelIds));
        }

        if ($request->filled('media_ids')) {
            $mediaIds = $request->input('media_ids');
            $query->whereHas('medias', fn ($q) => $q->whereIn('medias.id', $mediaIds));
        }

        if ($request->filled('author_id')) {
            $query->where('user_id', $request->input('author_id'));
        }

        if ($request->filled('author_name')) {
            $authorName = $request->input('author_name');
            $query->whereHas('user', function ($q) use ($authorName) {
                $q->where('name', 'like', "%{$authorName}%")
                  ->orWhere('first_name', 'like', "%{$authorName}%")
                  ->orWhere('last_name', 'like', "%{$authorName}%");
            });
        }

        // Rangos de fechas
        if ($request->filled('created_from')) {
            $query->whereDate('posts.created_at', '>=', $request->input('created_from'));
        }
        if ($request->filled('created_to')) {
            $query->whereDate('posts.created_at', '<=', $request->input('created_to'));
        }
        if ($request->filled('scheduled_from')) {
            $query->whereDate('scheduled_at', '>=', $request->input('scheduled_from'));
        }
        if ($request->filled('scheduled_to')) {
            $query->whereDate('scheduled_at', '<=', $request->input('scheduled_to'));
        }
        if ($request->filled('published_from')) {
            $query->whereDate('published_at', '>=', $request->input('published_from'));
        }
        if ($request->filled('published_to')) {
            $query->whereDate('published_at', '<=', $request->input('published_to'));
        }

        if ($request->has('has_attachments')) {
            $hasAttachments = filter_var($request->input('has_attachments'), FILTER_VALIDATE_BOOLEAN);
            if ($hasAttachments) {
                $query->has('attachments');
            } else {
                $query->doesntHave('attachments');
            }
        }

        // ── Ordenamiento ──
        $sortBy    = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // ── Paginación ──
        $perPage = (int) $request->input('per_page', 20);
        $posts   = $query->paginate($perPage);

        return response()->json([
            'status'  => 'success',
            'data'    => $posts,
            'total'   => $posts->total(),
            'message' => 'Listado de publicaciones obtenido correctamente.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // CREACIÓN (H09)
    // ════════════════════════════════════════════════════════════

    /**
     * POST /api/posts
     *
     * Crear una nueva publicación en estado borrador.
     */
    public function store(StorePostRequest $request): JsonResponse
    {
        $user = $request->user();

        // Verificar que los canales seleccionados están autorizados para este publicador
        $authorizedChannelIds = $user->channels()->pluck('channels.id')->toArray();
        $requestedChannelIds = $request->input('channel_ids');

        $unauthorizedChannels = array_diff($requestedChannelIds, $authorizedChannelIds);

        if (!empty($unauthorizedChannels)) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene autorización para publicar en uno o más canales seleccionados.',
            ], 403);
        }

        // Verificar que los medios pertenecen a los canales seleccionados
        if ($request->filled('media_ids')) {
            $validMediaIds = DB::table('channel_medias')
                ->whereIn('channel_id', $requestedChannelIds)
                ->pluck('media_id')
                ->unique()
                ->toArray();

            $requestedMediaIds = $request->input('media_ids');
            $invalidMedias = array_diff($requestedMediaIds, $validMediaIds);

            if (!empty($invalidMedias)) {
                return response()->json([
                    'status'  => 'error',
                    'data'    => null,
                    'message' => 'Uno o más medios seleccionados no pertenecen a los canales indicados.',
                ], 422);
            }
        }

        $post = DB::transaction(function () use ($request, $user) {
            // Crear la publicación en estado borrador
            $post = Post::create([
                'user_id'      => $user->id,
                'name'         => $request->input('name'),
                'content'      => $request->input('content'),
                'type'         => $request->input('type'),
                'status'       => PostStatus::DRAFT->value,
                'scheduled_at' => $request->input('scheduled_at'),
            ]);

            // Asociar canales (N:M)
            $post->channels()->attach($request->input('channel_ids'));

            // Asociar medios (N:M)
            if ($request->filled('media_ids')) {
                $post->medias()->attach($request->input('media_ids'));
            }

            // Guardar archivos adjuntos
            if ($request->hasFile('attachments')) {
                foreach ($request->file('attachments') as $file) {
                    $path = $file->store("posts/{$post->id}", 'public');

                    $post->attachments()->create([
                        'mime_type' => $file->getClientMimeType(),
                        'path'      => $path,
                    ]);
                }
            }

            // Registrar historial de creación
            PostHistory::record(
                postId: $post->id,
                userId: $user->id,
                action: PostHistory::ACTION_CREATED,
                snapshot: PostHistory::takeSnapshot($post),
                request: $request,
            );

            return $post;
        });

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación creada correctamente en estado borrador.',
        ], 201);
    }

    // ════════════════════════════════════════════════════════════
    // DETALLE (H09)
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/posts/{post}
     *
     * Detalle de una publicación.
     * Publicador: solo ve sus propias publicaciones.
     * Moderador/Admin: cualquier publicación.
     */
    public function show(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para ver esta publicación.',
            ], 403);
        }

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments', 'user:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Detalle de la publicación obtenido correctamente.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // EDICIÓN (H10)
    // ════════════════════════════════════════════════════════════

    /**
     * PUT /api/posts/{post}
     *
     * Editar una publicación existente.
     * Solo se permite edición completa en estado "draft".
     * En otros estados, debe revertir a draft primero.
     */
    public function update(UpdatePostRequest $request, Post $post): JsonResponse
    {
        $user = $request->user();

        // Verificar propiedad
        if ($post->user_id !== $user->id) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para editar esta publicación.',
            ], 403);
        }

        // Verificar que el estado permite edición
        if (!$post->isFullyEditable()) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden editar publicaciones en estado borrador. Revierta a borrador primero.',
            ], 422);
        }

        // Verificar canales autorizados si se modifican
        if ($request->filled('channel_ids')) {
            $authorizedChannelIds = $user->channels()->pluck('channels.id')->toArray();
            $unauthorizedChannels = array_diff($request->input('channel_ids'), $authorizedChannelIds);

            if (!empty($unauthorizedChannels)) {
                return response()->json([
                    'status'  => 'error',
                    'data'    => null,
                    'message' => 'No tiene autorización para publicar en uno o más canales seleccionados.',
                ], 403);
            }
        }

        // Verificar medios pertenecen a canales
        if ($request->filled('media_ids')) {
            $channelIds = $request->input('channel_ids', $post->channels->pluck('id')->toArray());
            $validMediaIds = DB::table('channel_medias')
                ->whereIn('channel_id', $channelIds)
                ->pluck('media_id')
                ->unique()
                ->toArray();

            $invalidMedias = array_diff($request->input('media_ids'), $validMediaIds);

            if (!empty($invalidMedias)) {
                return response()->json([
                    'status'  => 'error',
                    'data'    => null,
                    'message' => 'Uno o más medios seleccionados no pertenecen a los canales indicados.',
                ], 422);
            }
        }

        $post = DB::transaction(function () use ($request, $post, $user) {
            // Capturar snapshot antes de cambios
            $snapshotBefore = PostHistory::takeSnapshot($post);

            $changes = [];

            // Actualizar campos del post
            $editableFields = ['name', 'content', 'type', 'scheduled_at'];
            foreach ($editableFields as $field) {
                if ($request->has($field)) {
                    $oldValue = $post->getAttribute($field);
                    $newValue = $request->input($field);

                    // Normalizar para comparación
                    if ($oldValue instanceof \BackedEnum) {
                        $oldValue = $oldValue->value;
                    }
                    if ($oldValue instanceof \DateTimeInterface) {
                        $oldValue = $oldValue->toISOString();
                    }

                    if ((string) $oldValue !== (string) $newValue) {
                        $changes[$field] = ['old' => $oldValue, 'new' => $newValue];
                    }

                    $post->{$field} = $newValue;
                }
            }

            $post->save();

            // Sincronizar canales si se modifican
            if ($request->filled('channel_ids')) {
                $oldChannelIds = $post->channels->pluck('id')->sort()->values()->toArray();
                $newChannelIds = collect($request->input('channel_ids'))->sort()->values()->toArray();

                if ($oldChannelIds !== $newChannelIds) {
                    $post->channels()->sync($request->input('channel_ids'));
                    $changes['channel_ids'] = ['old' => $oldChannelIds, 'new' => $newChannelIds];
                }
            }

            // Sincronizar medios si se modifican
            if ($request->has('media_ids')) {
                $oldMediaIds = $post->medias->pluck('id')->sort()->values()->toArray();
                $newMediaIds = collect($request->input('media_ids', []))->sort()->values()->toArray();

                if ($oldMediaIds !== $newMediaIds) {
                    $post->medias()->sync($request->input('media_ids', []));
                    $changes['media_ids'] = ['old' => $oldMediaIds, 'new' => $newMediaIds];
                }
            }

            // Guardar nuevos archivos adjuntos
            if ($request->hasFile('attachments')) {
                $newAttachments = [];
                foreach ($request->file('attachments') as $file) {
                    $path = $file->store("posts/{$post->id}", 'public');

                    $attachment = $post->attachments()->create([
                        'mime_type' => $file->getClientMimeType(),
                        'path'      => $path,
                    ]);

                    $newAttachments[] = [
                        'id'        => $attachment->id,
                        'mime_type' => $attachment->mime_type,
                        'path'      => $attachment->path,
                    ];
                }

                $changes['attachments_added'] = $newAttachments;
            }

            // Registrar historial si hubo cambios
            if (!empty($changes)) {
                $post->refresh();
                PostHistory::record(
                    postId: $post->id,
                    userId: $user->id,
                    action: PostHistory::ACTION_EDITED,
                    changes: $changes,
                    snapshot: PostHistory::takeSnapshot($post),
                    request: $request,
                );
            }

            return $post;
        });

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments', 'user:id,name,first_name,last_name']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación actualizada correctamente.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // REVERTIR A BORRADOR (H10)
    // ════════════════════════════════════════════════════════════

    /**
     * POST /api/posts/{post}/revert-to-draft
     *
     * Revertir una publicación de estado "scheduled" o "published" a "draft".
     * - Publicador: solo sus propias publicaciones.
     * - Moderador/Admin: cualquier publicación.
     */
    public function revertToDraft(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        // Verificar permisos
        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para modificar esta publicación.',
            ], 403);
        }

        $allowedStatuses = [PostStatus::SCHEDULED, PostStatus::PUBLISHED, PostStatus::PENDING_REVIEW];

        if (!in_array($post->status, $allowedStatuses)) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden revertir a borrador publicaciones en estado programado, publicado o pendiente de revisión.',
            ], 422);
        }

        $oldStatus = $post->status->value;

        $post->update(['status' => PostStatus::DRAFT->value]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_STATUS_CHANGED,
            changes: ['status' => ['old' => $oldStatus, 'new' => PostStatus::DRAFT->value]],
            snapshot: PostHistory::takeSnapshot($post),
            comment: 'Publicación revertida a borrador.',
            request: $request,
        );

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación revertida a estado borrador. Requiere nueva moderación.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // ENVIAR A MODERACIÓN (H13)
    // ════════════════════════════════════════════════════════════

    /**
     * POST /api/posts/{post}/submit
     *
     * Enviar una publicación en estado "draft" a moderación.
     */
    public function submitForReview(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        if ($post->user_id !== $user->id) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para enviar esta publicación a moderación.',
            ], 403);
        }

        if ($post->status !== PostStatus::DRAFT) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden enviar a moderación publicaciones en estado borrador.',
            ], 422);
        }

        $post->update([
            'status'             => PostStatus::PENDING_REVIEW->value,
            'moderator_comments' => null,
        ]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_SUBMITTED,
            changes: ['status' => ['old' => PostStatus::DRAFT->value, 'new' => PostStatus::PENDING_REVIEW->value]],
            snapshot: PostHistory::takeSnapshot($post),
            request: $request,
        );

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación enviada a moderación correctamente.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // ELIMINACIÓN (H11)
    // ════════════════════════════════════════════════════════════

    /**
     * DELETE /api/posts/{post}
     *
     * Eliminar una publicación (soft delete).
     * Requiere motivo. No se permite en estado "published" ni "archived".
     */
    public function destroy(DeletePostRequest $request, Post $post): JsonResponse
    {
        Log::info('1. Entró al destroy', ['post_id' => $post->id, 'user_id' => $request->user()->id]);
        $user = $request->user();

        // Verificar propiedad o rol admin/moderador
        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            Log::warning('2. Error de permisos');
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para eliminar esta publicación.',
            ], 403);
        }

        // Verificar estado permite eliminación
        if (!$post->isDeletable()) {
            Log::warning('3. No es eliminable', ['status' => $post->status]);
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No se puede eliminar una publicación en estado "' . $post->status->label() . '". Solo se pueden eliminar publicaciones en estado borrador, pendiente de revisión, aprobada o programada.',
            ], 422);
        }

        $reason = $request->input('reason');

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_DELETED,
            snapshot: PostHistory::takeSnapshot($post),
            comment: $reason,
            request: $request,
        );

        Log::info('6. Historial grabado, procediendo a actualizar post');
        $post->update(['deleted_by' => $user->id]);
        $post->delete(); // Soft delete

        Log::info('7. envia respuesta JSON');
        return response()->json([
            'status'  => 'success',
            'data'    => null,
            'message' => 'Publicación eliminada correctamente.',
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // ARCHIVADO (H12)
    // ════════════════════════════════════════════════════════════

    /**
     * POST /api/posts/{post}/archive
     *
     * Archivar una publicación en estado "scheduled" o "published".
     */
    public function archive(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        // Verificar propiedad o rol moderador/admin
        if ($post->user_id !== $user->id && !$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para archivar esta publicación.',
            ], 403);
        }

        if (!$post->isArchivable()) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden archivar publicaciones en estado programado o publicado.',
            ], 422);
        }

        // Requiere confirmación
        if (!$request->boolean('confirm')) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Debe confirmar el archivado de la publicación.',
            ], 422);
        }

        $oldStatus = $post->status->value;

        $post->update([
            'status'      => PostStatus::ARCHIVED->value,
            'archived_by' => $user->id,
            'archived_at' => now(),
        ]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_ARCHIVED,
            changes: ['status' => ['old' => $oldStatus, 'new' => PostStatus::ARCHIVED->value]],
            snapshot: PostHistory::takeSnapshot($post),
            request: $request,
        );

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación archivada correctamente.',
        ]);
    }

    /**
     * POST /api/posts/{post}/unarchive
     *
     * Restaurar una publicación archivada. Solo moderadores/admin.
     */
    public function unarchive(Request $request, Post $post): JsonResponse
    {
        $user = $request->user();

        if (!$user->hasRole(['moderador', 'admin'])) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo moderadores y administradores pueden restaurar publicaciones archivadas.',
            ], 403);
        }

        if ($post->status !== PostStatus::ARCHIVED) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Solo se pueden restaurar publicaciones en estado archivado.',
            ], 422);
        }

        $post->update([
            'status'      => PostStatus::DRAFT->value,
            'archived_by' => null,
            'archived_at' => null,
        ]);

        PostHistory::record(
            postId: $post->id,
            userId: $user->id,
            action: PostHistory::ACTION_UNARCHIVED,
            changes: ['status' => ['old' => PostStatus::ARCHIVED->value, 'new' => PostStatus::DRAFT->value]],
            snapshot: PostHistory::takeSnapshot($post),
            request: $request,
        );

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación restaurada a estado borrador.',
        ]);
    }
}
