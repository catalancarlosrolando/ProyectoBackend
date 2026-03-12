<?php

namespace App\Http\Controllers\Api;

use App\Models\SavedFilter;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Controlador para filtros guardados de publicaciones.
 *
 * Funcionalidades (H11b):
 * - Listar, crear y eliminar "vistas personalizadas" de filtros
 */
class SavedFilterController extends Controller
{
    /**
     * GET /api/posts/saved-filters
     *
     * Listar filtros guardados del usuario autenticado.
     */
    public function index(Request $request): JsonResponse
    {
        $filters = $request->user()->savedFilters()->orderBy('name')->get();

        return response()->json([
            'status'  => 'success',
            'data'    => $filters,
            'message' => 'Filtros guardados obtenidos correctamente.',
        ]);
    }

    /**
     * POST /api/posts/saved-filters
     *
     * Crear un nuevo filtro guardado.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name'    => 'required|string|max:100',
            'filters' => 'required|array',
        ], [
            'name.required'    => 'El nombre del filtro es obligatorio.',
            'name.max'         => 'El nombre del filtro no puede superar los 100 caracteres.',
            'filters.required' => 'Debe proporcionar la configuración de filtros.',
            'filters.array'    => 'Los filtros deben ser un objeto válido.',
        ]);

        $user = $request->user();

        // Verificar que no exista un filtro con el mismo nombre para este usuario
        $exists = $user->savedFilters()->where('name', $request->input('name'))->exists();

        if ($exists) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'Ya existe un filtro guardado con ese nombre.',
            ], 422);
        }

        $filter = $user->savedFilters()->create([
            'name'    => $request->input('name'),
            'filters' => $request->input('filters'),
        ]);

        return response()->json([
            'status'  => 'success',
            'data'    => $filter,
            'message' => 'Filtro guardado correctamente.',
        ], 201);
    }

    /**
     * DELETE /api/posts/saved-filters/{filter}
     *
     * Eliminar un filtro guardado.
     */
    public function destroy(Request $request, SavedFilter $filter): JsonResponse
    {
        if ($filter->user_id !== $request->user()->id) {
            return response()->json([
                'status'  => 'error',
                'data'    => null,
                'message' => 'No tiene permiso para eliminar este filtro.',
            ], 403);
        }

        $filter->delete();

        return response()->json([
            'status'  => 'success',
            'data'    => null,
            'message' => 'Filtro eliminado correctamente.',
        ]);
    }
}
