using Microsoft.EntityFrameworkCore;
using StewardSync.Data;
using StewardSync.Models;

namespace StewardSync.Services
{
    public class UserService
    {
        private readonly StewardSyncDbContext _context;

        public UserService(StewardSyncDbContext context)
        {
            _context = context;
        }

        public async Task<List<User>> GetAllUsersAsync()
        {
            return await _context.Users
                .Include(u => u.Role)
                .OrderBy(u => u.UserName)
                .ToListAsync();
        }

        public async Task<User?> GetUserByIdAsync(int id)
        {
            return await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserId == id);
        }

        public async Task<User?> GetUserByUsernameAsync(string username)
        {
            return await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserName == username);
        }

        public async Task<User> CreateUserAsync(User user)
        {
            // Validate that the role exists
            var role = await _context.Roles.FindAsync(user.RoleId);
            if (role == null)
            {
                throw new ArgumentException("Invalid role specified.");
            }

            // Check if username already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.UserName == user.UserName);

            if (existingUser != null)
            {
                throw new ArgumentException("Username already exists.");
            }

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return user;
        }

        public async Task<User> UpdateUserAsync(User user)
        {
            // Validate that the role exists
            var role = await _context.Roles.FindAsync(user.RoleId);
            if (role == null)
            {
                throw new ArgumentException("Invalid role specified.");
            }

            // Check if username is being changed and if new username already exists
            var existingUser = await _context.Users
                .FirstOrDefaultAsync(u => u.UserName == user.UserName && u.UserId != user.UserId);

            if (existingUser != null)
            {
                throw new ArgumentException("Username already exists.");
            }

            _context.Entry(user).State = EntityState.Modified;
            await _context.SaveChangesAsync();
            return user;
        }

        public async Task DeleteUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
            {
                throw new ArgumentException("User not found.");
            }

            // Check if user has any reviews
            var hasReviews = await _context.Reviews
                .AnyAsync(r => r.UserId == userId);

            if (hasReviews)
            {
                throw new InvalidOperationException("Cannot delete user with existing reviews.");
            }

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();
        }

        public async Task<List<Role>> GetAllRolesAsync()
        {
            return await _context.Roles
                .OrderBy(r => r.RoleName)
                .ToListAsync();
        }

        public async Task<Role?> GetRoleByIdAsync(int id)
        {
            return await _context.Roles.FindAsync(id);
        }

        public async Task<Role?> GetRoleByNameAsync(string roleName)
        {
            return await _context.Roles
                .FirstOrDefaultAsync(r => r.RoleName == roleName);
        }

        public bool CanUserReportIncident(User user)
        {
            // All users can report incidents
            return true;
        }

        public bool CanUserReviewReport(User user)
        {
            return user.Role.RoleName == "Steward" ||
                   user.Role.RoleName == "Head Steward" ||
                   user.Role.RoleName == "Event Manager";
        }

        public bool CanUserFinalizeReport(User user)
        {
            return user.Role.RoleName == "Head Steward" ||
                   user.Role.RoleName == "Event Manager";
        }

        public async Task<List<User>> GetUsersByRoleAsync(string roleName)
        {
            return await _context.Users
                .Include(u => u.Role)
                .Where(u => u.Role.RoleName == roleName)
                .OrderBy(u => u.UserName)
                .ToListAsync();
        }

        public async Task<bool> AuthenticateUserAsync(string username, string password)
        {
            // In a real application, you would hash the password and compare with stored hash
            // For now, we'll do a simple check
            var user = await GetUserByUsernameAsync(username);
            return user != null; // Simplified authentication
        }
    }
}
