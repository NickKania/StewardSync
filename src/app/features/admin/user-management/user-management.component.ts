import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '@core/services/convex.service';
import { ToastService } from '@core/services/toast.service';
import { AuthService } from '@core/services/auth.service';
import { CardComponent } from '@shared/components/card/card.component';
import { ButtonComponent } from '@shared/components/button/button.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { LoadingComponent } from '@shared/components/loading/loading.component';
import { ModalComponent } from '@shared/components/modal/modal.component';
import { DateFormatPipe } from '@shared/pipes/date-format.pipe';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    LoadingComponent,
    ModalComponent,
    DateFormatPipe
  ],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">User Management</h1>
        <p class="text-gray-500 mt-1">Manage user roles and permissions</p>
      </div>

      <!-- Users table -->
      <app-card title="All Users" [noPadding]="true">
        @if (loading()) {
          <div class="py-12">
            <app-loading text="Loading users..." />
          </div>
        } @else if (users().length > 0) {
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-gray-50">
                <tr class="text-left text-sm text-gray-500">
                  <th class="px-6 py-3 font-medium">User</th>
                  <th class="px-6 py-3 font-medium">Email</th>
                  <th class="px-6 py-3 font-medium">Role</th>
                  <th class="px-6 py-3 font-medium">Joined</th>
                  <th class="px-6 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (user of users(); track user._id) {
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-3">
                        @if (user.avatarUrl) {
                          <img
                            [src]="user.avatarUrl"
                            [alt]="user.name"
                            class="w-8 h-8 rounded-full"
                          />
                        } @else {
                          <div class="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <span class="text-sm font-medium text-primary-700">
                              {{ user.name.charAt(0).toUpperCase() }}
                            </span>
                          </div>
                        }
                        <span class="font-medium text-gray-900">{{ user.name }}</span>
                      </div>
                    </td>
                    <td class="px-6 py-4 text-gray-500">{{ user.email }}</td>
                    <td class="px-6 py-4">
                      <app-badge [variant]="getRoleVariant(user.role?.name)">
                        {{ user.role?.displayName }}
                      </app-badge>
                    </td>
                    <td class="px-6 py-4 text-gray-500 text-sm">
                      {{ user.createdAt | dateFormat:'PP' }}
                    </td>
                    <td class="px-6 py-4">
                      <app-button
                        variant="ghost"
                        size="sm"
                        (onClick)="openEditModal(user)"
                      >
                        Edit Role
                      </app-button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <div class="text-center py-12">
            <p class="text-gray-500">No users found</p>
          </div>
        }
      </app-card>
    </div>

    <!-- Edit role modal -->
    <app-modal
      [isOpen]="showEditModal"
      title="Edit User Role"
      (close)="closeEditModal()"
    >
      @if (selectedUser) {
        <div class="space-y-4">
          <div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            @if (selectedUser.avatarUrl) {
              <img
                [src]="selectedUser.avatarUrl"
                [alt]="selectedUser.name"
                class="w-10 h-10 rounded-full"
              />
            } @else {
              <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                <span class="font-medium text-primary-700">
                  {{ selectedUser.name.charAt(0).toUpperCase() }}
                </span>
              </div>
            }
            <div>
              <p class="font-medium text-gray-900">{{ selectedUser.name }}</p>
              <p class="text-sm text-gray-500">{{ selectedUser.email }}</p>
            </div>
          </div>

          <div>
            <label class="label">New Role</label>
            <select class="input" [(ngModel)]="selectedRoleId">
              @for (role of roles(); track role._id) {
                <option [value]="role._id">{{ role.displayName }}</option>
              }
            </select>
          </div>
        </div>
      }

      @if (selectedUser) {
        <div modal-footer class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          <app-button variant="secondary" (onClick)="closeEditModal()">
            Cancel
          </app-button>
          <app-button
            variant="primary"
            [loading]="saving()"
            (onClick)="saveRole()"
          >
            Save Changes
          </app-button>
        </div>
      }
    </app-modal>
  `
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private convex = inject(ConvexService);
  private toast = inject(ToastService);
  private authService = inject(AuthService);

  users = signal<any[]>([]);
  roles = signal<any[]>([]);
  loading = signal(true);
  saving = signal(false);

  showEditModal = false;
  selectedUser: any = null;
  selectedRoleId = '';

  private unsubscribes: (() => void)[] = [];

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.unsubscribes.forEach(unsub => unsub());
  }

  private loadData(): void {
    // Load users
    const usersQuery = this.convex.createReactiveQuery(
      this.convex.api.users.list,
      {}
    );
    this.unsubscribes.push(usersQuery.unsubscribe);

    const checkUsers = setInterval(() => {
      const data = usersQuery.data();
      if (data !== undefined) {
        this.users.set(data);
        this.loading.set(false);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkUsers));

    // Load roles
    const rolesQuery = this.convex.createReactiveQuery(
      this.convex.api.users.listRoles,
      {}
    );
    this.unsubscribes.push(rolesQuery.unsubscribe);

    const checkRoles = setInterval(() => {
      const data = rolesQuery.data();
      if (data !== undefined) {
        this.roles.set(data);
      }
    }, 100);
    this.unsubscribes.push(() => clearInterval(checkRoles));
  }

  getRoleVariant(roleName: string | undefined): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
    switch (roleName) {
      case 'league_manager': return 'success';
      case 'event_manager': return 'primary';
      case 'head_steward': return 'info';
      case 'steward': return 'warning';
      default: return 'default';
    }
  }

  openEditModal(user: any): void {
    this.selectedUser = user;
    this.selectedRoleId = user.roleId;
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.selectedUser = null;
    this.selectedRoleId = '';
  }

  async saveRole(): Promise<void> {
    if (!this.selectedUser || !this.selectedRoleId) return;

    const currentUserId = this.authService.getUserId();
    if (!currentUserId) {
      this.toast.error('Not authenticated');
      return;
    }

    this.saving.set(true);

    try {
      await this.convex.mutation(
        this.convex.api.users.updateRole,
        {
          userId: this.selectedUser._id,
          roleId: this.selectedRoleId as any,
          currentUserId: currentUserId
        }
      );

      this.toast.success('User role updated successfully');
      this.closeEditModal();
    } catch (error: any) {
      const errorMessage = this.extractUserFacingError(error.message);
      this.toast.error(errorMessage || 'Failed to update role');
    } finally {
      this.saving.set(false);
    }
  }

  private extractUserFacingError(errorMessage: string): string {
    // Convex wraps errors with a prefix like:
    // "[CONVEX M(users:updateRole)] [Request ID: xxx] Server Error Uncaught UserFacingError: ..."
    // We want to extract just the part after "Uncaught UserFacingError: " or "Error: "
    if (!errorMessage) return "";

    // Try to extract UserFacingError message
    const userFacingMatch = errorMessage.match(/Uncaught UserFacingError:\s*(.+?)(?:\s+at\s+|$)/s);
    if (userFacingMatch) {
      return userFacingMatch[1].trim();
    }

    // Try to extract regular Error message as fallback
    const errorMatch = errorMessage.match(/Error:\s*(.+?)(?:\s+at\s+|$)/s);
    if (errorMatch) {
      return errorMatch[1].trim();
    }

    // If no pattern matches, return original message
    return errorMessage;
  }
}
