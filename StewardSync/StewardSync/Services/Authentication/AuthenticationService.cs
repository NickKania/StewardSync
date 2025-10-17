using StewardSync.Models;

namespace StewardSync.Services.Authentication
{
    public class AuthenticationService
    {
        private User? _currentUser;

        public User? CurrentUser => _currentUser;

        public bool IsAuthenticated => _currentUser != null;

        public async Task<User?> LoginAsync(string username, string password)
        {
            // Simple demo authentication - in production, use proper password hashing
            if (string.IsNullOrEmpty(username))
                return null;

            // Demo users with hardcoded "password"
            var demoUsers = new Dictionary<string, User>
            {
                ["headsteward"] = new User { UserId = 1, UserName = "headsteward", Role = new Role { RoleId = 3, RoleName = "Head Steward" } },
                ["steward1"] = new User { UserId = 2, UserName = "steward1", Role = new Role { RoleId = 2, RoleName = "Steward" } },
                ["eventmanager"] = new User { UserId = 3, UserName = "eventmanager", Role = new Role { RoleId = 4, RoleName = "Event Manager" } },
                ["driver1"] = new User { UserId = 4, UserName = "driver1", Role = new Role { RoleId = 1, RoleName = "Driver" } }
            };

            if (password == "password" && demoUsers.TryGetValue(username, out var user))
            {
                _currentUser = user;
                return user;
            }

            return null;
        }

        public void Logout()
        {
            _currentUser = null;
        }

        public bool CanUserReportIncident()
        {
            return IsAuthenticated;
        }

        public bool CanUserReviewReport()
        {
            return IsAuthenticated && (
                _currentUser!.Role.RoleName == "Steward" ||
                _currentUser!.Role.RoleName == "Head Steward" ||
                _currentUser!.Role.RoleName == "Event Manager"
            );
        }

        public bool CanUserFinalizeReport()
        {
            return IsAuthenticated && (
                _currentUser!.Role.RoleName == "Head Steward" ||
                _currentUser!.Role.RoleName == "Event Manager"
            );
        }
    }
}
