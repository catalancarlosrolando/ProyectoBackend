<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Http\JsonResponse;

class FileController extends Controller
{
    /**
     * Subir archivos adjuntos
     */
    public function upload(Request $request): JsonResponse
    {
        try {
            $validator = Validator::make($request->all(), [
                'files' => 'required|array|max:10',
                'files.*' => 'required|file|max:10240', // 10MB por archivo
                'description' => 'nullable|string|max:500',
                'folder' => 'nullable|string|max:100|alpha_dash'
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Error de validación',
                    'errors' => $validator->errors()
                ], 422);
            }

            $uploadedFiles = [];
            $folder = $request->input('folder', 'uploads');

            foreach ($request->file('files') as $file) {
                // Generar nombre único
                $originalName = $file->getClientOriginalName();
                $extension = $file->getClientOriginalExtension();
                $filename = time() . '_' . uniqid() . '.' . $extension;

                // Almacenar archivo
                $path = $file->storeAs($folder, $filename, 'public');

                $uploadedFiles[] = [
                    'original_name' => $originalName,
                    'stored_name' => $filename,
                    'path' => $path,
                    'url' => Storage::url($path),
                    'size' => $file->getSize(),
                    'mime_type' => $file->getMimeType(),
                    'extension' => $extension
                ];
            }

            return response()->json([
                'status' => 'success',
                'message' => 'Archivos subidos exitosamente',
                'data' => [
                    'files' => $uploadedFiles,
                    'description' => $request->input('description'),
                    'folder' => $folder,
                    'total_files' => count($uploadedFiles)
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error interno del servidor',
                'error' => app()->environment('local') ? $e->getMessage() : 'Error procesando los archivos'
            ], 500);
        }
    }

    /**
     * Listar archivos subidos
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $folder = $request->input('folder', 'uploads');
            $files = Storage::disk('public')->files($folder);

            $fileList = [];
            foreach ($files as $file) {
                $fileInfo = [
                    'name' => basename($file),
                    'path' => $file,
                    'url' => Storage::url($file),
                    'size' => Storage::disk('public')->size($file),
                    'last_modified' => Storage::disk('public')->lastModified($file)
                ];
                $fileList[] = $fileInfo;
            }

            return response()->json([
                'status' => 'success',
                'data' => [
                    'files' => $fileList,
                    'folder' => $folder,
                    'total' => count($fileList)
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error listando archivos',
                'error' => app()->environment('local') ? $e->getMessage() : 'Error accediendo a los archivos'
            ], 500);
        }
    }

    /**
     * Descargar archivo
     */
    public function download(Request $request, string $filename)
    {
        try {
            $folder = $request->input('folder', 'uploads');
            $path = $folder . '/' . $filename;

            if (!Storage::disk('public')->exists($path)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Archivo no encontrado'
                ], 404);
            }

            return response()->download(
                Storage::disk('public')->path($path),
                $filename
            );

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error descargando archivo',
                'error' => app()->environment('local') ? $e->getMessage() : 'Error accediendo al archivo'
            ], 500);
        }
    }

    /**
     * Eliminar archivo
     */
    public function delete(Request $request, string $filename): JsonResponse
    {
        try {
            $folder = $request->input('folder', 'uploads');
            $path = $folder . '/' . $filename;

            if (!Storage::disk('public')->exists($path)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Archivo no encontrado'
                ], 404);
            }

            Storage::disk('public')->delete($path);

            return response()->json([
                'status' => 'success',
                'message' => 'Archivo eliminado exitosamente'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Error eliminando archivo',
                'error' => app()->environment('local') ? $e->getMessage() : 'Error eliminando el archivo'
            ], 500);
        }
    }
}
