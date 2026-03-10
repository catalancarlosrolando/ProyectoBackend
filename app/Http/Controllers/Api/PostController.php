<?php

namespace App\Http\Controllers\Api;

use App\Models\Post;
use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePostRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Controlador para la gestión de publicaciones.
 *
 * Funcionalidades:
 * - Crear una publicación en estado borrador con canales, medios y archivos adjuntos
 * - Listar las publicaciones del publicador autenticado
 * - Ver detalle de una publicación
 * - Ver todas las publicaciones de un canal (solo para moderadores y admin)
 */
class PostController extends Controller
{
    /**
     * GET /api/posts
     *
     * Listado de publicaciones del usuario autenticado.
     */
    public function index(Request $request): JsonResponse
    {
        $posts = Post::where('user_id', $request->user()->id)
            ->with(['channels:id,name,type', 'medias:id,name,type', 'attachments'])
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json([
            'status'  => 'success',
            'data'    => $posts,
            'message' => 'Listado de publicaciones obtenido correctamente.',
        ]);
    }

    /**
     * POST /api/posts
     *
     * Crear una nueva publicación.
     * Solo los publicadores pueden crear publicaciones.
     * Los canales seleccionados deben estar autorizados al publicador.
     * La publicación se guarda en estado "borrador" hasta aprobación del moderador.
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

            return $post;
        });

        $post->load(['channels:id,name,type', 'medias:id,name,type', 'attachments']);

        return response()->json([
            'status'  => 'success',
            'data'    => $post,
            'message' => 'Publicación creada correctamente en estado borrador.',
        ], 201);
    }

    /**
     * GET /api/posts/{post}
     *
     * Detalle de una publicación del usuario autenticado.
     */
    public function show(Request $request, Post $post): JsonResponse
    {
        if ($post->user_id !== $request->user()->id) {
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
}
