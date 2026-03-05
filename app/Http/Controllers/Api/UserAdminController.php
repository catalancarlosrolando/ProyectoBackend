<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Enums\UserStatus;
use App\Models\UserStatusHistory;
use App\Http\Controllers\Controller;
use App\Http\Requests\UserListRequest;
use App\Http\Requests\UserRoleRequest;
use App\Http\Requests\UserStatusChangeRequest;
use App\Notifications\UserStatusChangeNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

/**
 * Controlador para la gestión de usuarios por parte del administrador.
 *
 * Funcionalidades:
 * - Listado paginado con filtros y ordenamiento
 * - Aprobar / Rechazar solicitudes de registro
 * - Asignar / Revocar roles
 * - Habilitar / Deshabilitar cuentas
 * - Ver historial de cambios de un usuario
 */
class UserAdminController extends Controller
{
    /**
     * GET /api/admin/users
     *
     * Listado paginado de usuarios con filtros y ordenamiento.
     */
    public function index(UserListRequest $request): JsonResponse
    {
        $query = User::query()->with('roles');

        // Excluir usuarios con rol admin del listado
        $query->whereDoesntHave('roles', function ($q) {
            $q->where('name', 'admin');
        });

        // ── Filtros ──

        // Filtro por rol
        if ($request->filled('role')) {
            $query->whereHas('roles', function ($q) use ($request) {
                $q->where('name', $request->input('role'));
            });
        }

        // Filtro por estado
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filtro por email (búsqueda parcial)
        if ($request->filled('email')) {
            $query->where('email', 'like', '%' . $request->input('email') . '%');
        }

        // Filtro por nombre completo (búsqueda parcial)
        if ($request->filled('name')) {
            $searchName = $request->input('name');
            $query->where(function ($q) use ($searchName) {
                $q->where('name', 'like', "%{$searchName}%")
                  ->orWhere('first_name', 'like', "%{$searchName}%")
                  ->orWhere('last_name', 'like', "%{$searchName}%");
            });
        }

        // Filtro por DNI
        if ($request->filled('dni')) {
            $query->where('dni', $request->input('dni'));
        }

        // Filtro por rango de fecha de registro
        if ($request->filled('registered_from')) {
            $query->whereDate('created_at', '>=', $request->input('registered_from'));
        }
        if ($request->filled('registered_to')) {
            $query->whereDate('created_at', '<=', $request->input('registered_to'));
        }

        // Filtro por rango de último acceso
        if ($request->filled('last_access_from')) {
            $query->whereDate('last_access_at', '>=', $request->input('last_access_from'));
        }
        if ($request->filled('last_access_to')) {
            $query->whereDate('last_access_at', '<=', $request->input('last_access_to'));
        }

        // ── Ordenamiento ──
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // ── Paginación ──
        $perPage = $request->input('per_page', 20);
        $users = $query->paginate($perPage);

        // Transformar datos para la respuesta
        $usersData = $users->getCollection()->map(function (User $user) {
            return $this->formatUser($user);
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Listado de usuarios',
            'data' => [
                'users' => $usersData,
                'pagination' => [
                    'current_page' => $users->currentPage(),
                    'last_page' => $users->lastPage(),
                    'per_page' => $users->perPage(),
                    'total' => $users->total(),
                    'from' => $users->firstItem(),
                    'to' => $users->lastItem(),
                ],
            ],
        ]);
    }

    /**
     * GET /api/admin/users/{user}
     *
     * Ver detalle de un usuario.
     */
    public function show(User $user): JsonResponse
    {
        $user->load('roles');

        return response()->json([
            'status' => 'success',
            'message' => 'Detalle del usuario',
            'data' => [
                'user' => $this->formatUser($user),
            ],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/approve
     *
     * Aprobar una solicitud de registro.
     */
    public function approve(UserStatusChangeRequest $request, User $user): JsonResponse
    {
        if ($user->status === UserStatus::APPROVED) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario ya está aprobado.',
            ], 422);
        }

        $oldStatus = $user->status->value;
        $user->update(['status' => UserStatus::APPROVED->value]);

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_STATUS_CHANGE,
            $oldStatus,
            UserStatus::APPROVED->value,
            $request->input('reason')
        );

        // Notificar al usuario por email
        $this->notifyStatusChange($user, UserStatus::APPROVED->value, $request->input('reason'), $request->user()->name);

        return response()->json([
            'status' => 'success',
            'message' => 'Usuario aprobado exitosamente.',
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/reject
     *
     * Rechazar una solicitud de registro.
     */
    public function reject(UserStatusChangeRequest $request, User $user): JsonResponse
    {
        if ($user->status === UserStatus::DELETED) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario ya fue rechazado.',
            ], 422);
        }

        $oldStatus = $user->status->value;
        $reason = $request->input('reason');

        $user->update([
            'status' => UserStatus::DELETED->value,
            'rejection_reason' => $reason,
        ]);

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_STATUS_CHANGE,
            $oldStatus,
            UserStatus::DELETED->value,
            $reason
        );

        // Notificar al usuario por email
        $this->notifyStatusChange($user, UserStatus::DELETED->value, $reason, $request->user()->name);

        return response()->json([
            'status' => 'success',
            'message' => 'Solicitud de registro rechazada.',
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/enable
     *
     * Habilitar una cuenta de usuario deshabilitada.
     */
    public function enable(UserStatusChangeRequest $request, User $user): JsonResponse
    {
        if ($user->status !== UserStatus::DISABLED) {
            return response()->json([
                'status' => 'error',
                'message' => 'Solo se pueden habilitar cuentas que estén deshabilitadas.',
            ], 422);
        }

        $user->update(['status' => UserStatus::APPROVED->value]);

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_ENABLED,
            UserStatus::DISABLED->value,
            UserStatus::APPROVED->value,
            $request->input('reason')
        );

        // Notificar al usuario
        $this->notifyStatusChange($user, UserStatus::APPROVED->value, $request->input('reason'), $request->user()->name);

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta habilitada exitosamente.',
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/disable
     *
     * Deshabilitar una cuenta de usuario.
     * Invalida todas las sesiones activas del usuario.
     */
    public function disable(UserStatusChangeRequest $request, User $user): JsonResponse
    {
        // Prevenir que el admin se deshabilite a sí mismo
        if ($user->id === $request->user()->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'No puedes deshabilitar tu propia cuenta.',
            ], 403);
        }

        if ($user->status === UserStatus::DISABLED) {
            return response()->json([
                'status' => 'error',
                'message' => 'El usuario ya está deshabilitado.',
            ], 422);
        }

        $oldStatus = $user->status->value;
        $reason = $request->input('reason');

        $user->update(['status' => UserStatus::DISABLED->value]);

        // Invalidar todas las sesiones activas (tokens Sanctum)
        $user->tokens()->delete();

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_DISABLED,
            $oldStatus,
            UserStatus::DISABLED->value,
            $reason
        );

        // Notificar al usuario
        $this->notifyStatusChange($user, UserStatus::DISABLED->value, $reason, $request->user()->name);

        return response()->json([
            'status' => 'success',
            'message' => 'Cuenta deshabilitada e invalidadas todas sus sesiones.',
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/assign-role
     *
     * Asignar un rol a un usuario.
     */
    public function assignRole(UserRoleRequest $request, User $user): JsonResponse
    {
        $roleName = $request->input('role');

        if ($user->hasRole($roleName)) {
            return response()->json([
                'status' => 'error',
                'message' => "El usuario ya tiene el rol '{$roleName}'.",
            ], 422);
        }

        $user->assignRole($roleName);

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_ROLE_ASSIGNED,
            null,
            $roleName
        );

        return response()->json([
            'status' => 'success',
            'message' => "Rol '{$roleName}' asignado exitosamente.",
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * POST /api/admin/users/{user}/revoke-role
     *
     * Revocar un rol de un usuario.
     */
    public function revokeRole(UserRoleRequest $request, User $user): JsonResponse
    {
        $roleName = $request->input('role');

        if (!$user->hasRole($roleName)) {
            return response()->json([
                'status' => 'error',
                'message' => "El usuario no tiene el rol '{$roleName}'.",
            ], 422);
        }

        // Prevenir que un admin se quite su propio rol de admin
        if ($user->id === $request->user()->id && $roleName === 'admin') {
            return response()->json([
                'status' => 'error',
                'message' => 'No puedes revocarte tu propio rol de administrador.',
            ], 403);
        }

        $user->removeRole($roleName);

        // Registrar en historial
        UserStatusHistory::record(
            $user->id,
            $request->user()->id,
            UserStatusHistory::ACTION_ROLE_REVOKED,
            $roleName,
            null
        );

        return response()->json([
            'status' => 'success',
            'message' => "Rol '{$roleName}' revocado exitosamente.",
            'data' => ['user' => $this->formatUser($user->fresh()->load('roles'))],
        ]);
    }

    /**
     * GET /api/admin/users/{user}/history
     *
     * Ver el historial de cambios de un usuario.
     */
    public function history(User $user): JsonResponse
    {
        $history = $user->statusHistories()
            ->with('changedBy:id,name,email')
            ->get()
            ->map(function (UserStatusHistory $entry) {
                return [
                    'id' => $entry->id,
                    'action' => $entry->action,
                    'old_value' => $entry->old_value,
                    'new_value' => $entry->new_value,
                    'reason' => $entry->reason,
                    'changed_by' => $entry->changedBy ? [
                        'id' => $entry->changedBy->id,
                        'name' => $entry->changedBy->name,
                    ] : null,
                    'created_at' => $entry->created_at?->toISOString(),
                ];
            });

        return response()->json([
            'status' => 'success',
            'message' => 'Historial de cambios del usuario',
            'data' => [
                'user_id' => $user->id,
                'user_name' => $user->name,
                'history' => $history,
            ],
        ]);
    }

    // ── Helpers privados ──

    /**
     * Formatea un usuario para la respuesta JSON.
     */
    private function formatUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'mobile' => $user->mobile,
            'dni' => $user->dni,
            'status' => $user->status?->value ?? $user->getRawOriginal('status'),
            'status_label' => $user->status?->label() ?? $user->getRawOriginal('status'),
            'email_verified_at' => $user->email_verified_at?->toISOString(),
            'last_access_at' => $user->last_access_at?->toISOString(),
            'rejection_reason' => $user->rejection_reason,
            'roles' => $user->roles->pluck('name')->toArray(),
            'permissions' => $user->getAllPermissions()->pluck('name')->toArray(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }

    /**
     * Envía notificación de cambio de estado de forma segura.
     */
    private function notifyStatusChange(User $user, string $newStatus, ?string $reason, ?string $adminName): void
    {
        try {
            $user->notify(new UserStatusChangeNotification($newStatus, $reason, $adminName));
        } catch (\Exception $e) {
            Log::warning("No se pudo enviar notificación de cambio de estado al usuario {$user->id}: " . $e->getMessage());
        }
    }
}
